/**
 * Tests E2E para EPICA-04 — Modulo de inscripcion de atletas a planes
 * (subscriptions).
 *
 * PREREQUISITOS:
 * - DATABASE_URL configurado en .env apuntando a una DB de test con el schema migrado
 * - Modelos Subscription/LegalAcceptance.planId (FK) migrados (EPICA-04, DBA,
 *   migracion 20260821014759_epica_04_subscriptions)
 *
 * NOTA: Estos tests requieren la DB real. Ejecutar con: pnpm run test:e2e
 *
 * A diferencia de plans.e2e-spec.ts, Subscription.athleteId tiene una FK REAL
 * contra User (onDelete: Restrict) — igual que Plan.coachId — asi que el
 * beforeAll crea tambien atletas reales via Prisma (bypass de
 * /api/auth/register, no hace falta password real para firmar el JWT).
 *
 * Alcance (ver mensaje de asignacion del Lider Tecnico):
 * (1) Los 6 endpoints de SubscriptionsController: happy path, rechazo de
 *     validacion, y sin autenticacion en todos; rechazo por rol donde aplica.
 * (2) CA-009-7 de EPICA-03, cerrado por primera vez end-to-end: publicar un
 *     plan, aprobar una suscripcion (status APPROVED) y verificar que
 *     POST /plans/:id/unpublish responde 409 PLAN_HAS_SUBSCRIBERS. Un plan
 *     con solo suscripciones Pendientes SI se puede despublicar.
 * (3) CA-012-2/CA-012-3: una suscripcion Rechazada NO bloquea un reintento;
 *     Pendiente/Aprobada/Activa SI bloquean.
 * (4) CA-012-4: solicitar inscripcion a un plan no Publicado responde 409
 *     PLAN_NOT_PUBLISHED sin crear ninguna fila.
 * (5) CA-014-8 (D-10), los DOS casos exigidos por el plan de implementacion:
 *     (a) plan Archivado con una suscripcion Aprobada → 409 PLAN_NOT_PUBLISHED;
 *     (b) plan con status PERSISTIDO todavia en PUBLISHED pero endDate ya
 *     vencida, SIN que ningun GET de coach haya disparado el write-through
 *     de applyEffectiveStatusWriteThrough (simulado manipulando endDate
 *     directamente via Prisma tras publicar, sin volver a leer el plan como
 *     coach) → tambien 409 PLAN_NOT_PUBLISHED. En ambos casos la suscripcion
 *     permanece en Aprobada, sin LegalAcceptance creado.
 * (6) Titularidad: un atleta no puede aceptar el consentimiento de una
 *     suscripcion ajena; un coach no puede aprobar/rechazar solicitudes de
 *     planes que no son suyos.
 * (7) Atomicidad de accept-consent: en el happy path, LegalAcceptance y el
 *     cambio de estado a Activa quedan escritos juntos (verificado
 *     consultando LegalAcceptance directamente con Prisma).
 *
 * Alcance diferido a EPICA-05 (NO verificable en esta epica): CA-014-3 — el
 * bloqueo de acceso a sesiones sin consentimiento aceptado depende de
 * endpoints de sesiones que todavia no existen (D-9 del plan de
 * implementacion).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import supertest from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import {
  UserRole,
  IdentificationType,
  SubscriptionStatus,
  DocumentType,
} from '../generated/prisma/index.js';
import { ResponseInterceptor } from '../src/modules/common/interceptors/response.interceptor.js';
import { AuditResourcesInterceptor } from '../src/modules/common/interceptors/audit-resources.interceptor.js';
import { ProblemDetailFilter } from '../src/modules/common/filters/problem-detail.filter.js';
import { PrismaExceptionFilter } from '../src/modules/common/filters/prisma-exception.filter.js';
import { ValidationExceptionFilter } from '../src/modules/common/filters/validation-exception.filter.js';
import { GlobalExceptionFilter } from '../src/modules/common/filters/global-exception.filter.js';

// ── Helper para aplanar errores de validacion (igual que en main.ts) ──────────

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): { field: string; message: string }[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.children && error.children.length > 0) {
      return flattenValidationErrors(error.children, field);
    }

    const messages = Object.values(error.constraints ?? {});
    return messages.map((message) => ({ field, message }));
  });
}

// Cada it() de este archivo puede disparar varias requests HTTP secuenciales
// (buildPublishedPlan encadena 5 llamadas); mismo criterio que
// plans.e2e-spec.ts frente a la latencia real del pooler remoto.
vi.setConfig({ testTimeout: 20000 });

const RUN_ID = Date.now().toString(36);
const NAME_PREFIX = `E2E-SUB-${RUN_ID}-`;
/** Marca las requests del test de auditoria para poder limpiar solo sus filas. */
const AUDIT_AGENT = `audit-e2e-subscriptions-${RUN_ID}`;

let sequence = 0;
function nextName(base: string): string {
  sequence += 1;
  return `${NAME_PREFIX}${base}-${sequence}`;
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// ── Setup de la app ───────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;
let jwtService: JwtService;
let http: ReturnType<typeof app.getHttpServer>;

let coachId: string;
let otherCoachId: string;
let athleteId: string;
let otherAthleteId: string;
let coachToken: string;
let otherCoachToken: string;
let athleteToken: string;
let otherAthleteToken: string;
let adminToken: string;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  // Mismo orden que main.ts: AuditResourcesInterceptor va despues para ver la
  // carga tal como la retorna el controller, antes del envelope. Se registra
  // aqui (y no solo en audit.e2e-spec.ts) porque el test de
  // GET /subscriptions/pending necesita fixtures reales de coach/atleta/plan
  // que ya existen en este archivo.
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new AuditResourcesInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new PrismaExceptionFilter(),
    new ValidationExceptionFilter(),
    new ProblemDetailFilter(),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const flatErrors = flattenValidationErrors(errors);
        return new BadRequestException(flatErrors);
      },
    }),
  );
  app.setGlobalPrefix('api');

  await app.init();
  http = app.getHttpServer();

  prisma = app.get(PrismaService, { strict: false });

  // Subscription.athleteId y Plan.coachId son FK reales contra users(id) — se
  // crean coaches Y atletas reales (bypass de /api/auth/register, no hace
  // falta password real para firmar el JWT: JwtStrategy.validate() solo lee
  // el payload).
  const coach = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}coach@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.COACH,
      name: 'Coach E2E Subscriptions',
      phone: '3000000010',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-sub-coach`,
    },
  });
  const otherCoach = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}other-coach@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.COACH,
      name: 'Other Coach E2E Subscriptions',
      phone: '3000000011',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-sub-other-coach`,
    },
  });
  const athlete = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}athlete@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.ATHLETE,
      name: 'Athlete E2E Subscriptions',
      phone: '3000000012',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-sub-athlete`,
    },
  });
  const otherAthlete = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}other-athlete@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.ATHLETE,
      name: 'Other Athlete E2E Subscriptions',
      phone: '3000000013',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-sub-other-athlete`,
    },
  });
  coachId = coach.id;
  otherCoachId = otherCoach.id;
  athleteId = athlete.id;
  otherAthleteId = otherAthlete.id;

  const configService = app.get(ConfigService, { strict: false });
  jwtService = new JwtService({
    secret: configService.getOrThrow<string>('JWT_SECRET'),
  });

  coachToken = jwtService.sign({
    sub: coachId,
    email: coach.email,
    role: UserRole.COACH,
  });
  otherCoachToken = jwtService.sign({
    sub: otherCoachId,
    email: otherCoach.email,
    role: UserRole.COACH,
  });
  athleteToken = jwtService.sign({
    sub: athleteId,
    email: athlete.email,
    role: UserRole.ATHLETE,
  });
  otherAthleteToken = jwtService.sign({
    sub: otherAthleteId,
    email: otherAthlete.email,
    role: UserRole.ATHLETE,
  });
  adminToken = jwtService.sign({
    sub: `${NAME_PREFIX}admin-id`,
    email: 'admin-e2e-subscriptions@test.com',
    role: UserRole.ADMIN,
  });
});

afterAll(async () => {
  // Orden de limpieza: LegalAcceptance/Subscription primero (referencian
  // Plan/User via FK onDelete: Restrict), despues Plan (Phase/Week/Session/
  // SessionExercise cascadean), despues Exercise, y al final los Users.
  await prisma.auditLog.deleteMany({ where: { userAgent: AUDIT_AGENT } });
  await prisma.legalAcceptance.deleteMany({
    where: { userId: { in: [athleteId, otherAthleteId] } },
  });
  await prisma.subscription.deleteMany({
    where: { athleteId: { in: [athleteId, otherAthleteId] } },
  });
  await prisma.plan.deleteMany({
    where: { coachId: { in: [coachId, otherCoachId] } },
  });
  await prisma.exercise.deleteMany({
    where: { name: { startsWith: NAME_PREFIX } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [coachId, otherCoachId, athleteId, otherAthleteId] } },
  });
  await app.close();
});

/**
 * La escritura de auditoria es fire-and-forget despues de `finish`, asi que la
 * respuesta puede llegar antes que la fila. Se sondea en vez de asumir (mismo
 * patron que audit.e2e-spec.ts).
 */
async function esperarFilaAuditoria(
  where: Record<string, unknown>,
  intentos = 20,
): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < intentos; i++) {
    const fila = await prisma.auditLog.findFirst({
      where: { userAgent: AUDIT_AGENT, ...where },
      orderBy: { createdAt: 'desc' },
    });
    if (fila) return fila as unknown as Record<string, unknown>;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

// ── Helpers de fixtures ────────────────────────────────────────────────────────

/**
 * Construye un plan COMPLETO (fase -> semana -> sesion -> ejercicio) y lo
 * publica — listo para recibir solicitudes de inscripcion. Reutiliza el
 * mismo patron de buildCompletePlan de plans.e2e-spec.ts, adaptado a este
 * archivo.
 */
async function buildPublishedPlan(
  token: string,
  planOverrides: Record<string, unknown> = {},
): Promise<string> {
  const planRes = await supertest(http)
    .post('/api/plans')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: nextName('Plan'),
      startDate: pastDate(30),
      endDate: futureDate(30),
      ...planOverrides,
    })
    .expect(201);
  const planId = planRes.body.data.id as string;

  const phaseRes = await supertest(http)
    .post(`/api/plans/${planId}/phases`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: nextName('Fase') })
    .expect(201);
  const phaseId = phaseRes.body.data.id as string;

  const weekRes = await supertest(http)
    .post(`/api/plans/${planId}/phases/${phaseId}/weeks`)
    .set('Authorization', `Bearer ${token}`)
    .expect(201);
  const weekId = weekRes.body.data.id as string;

  const sessionRes = await supertest(http)
    .post(`/api/plans/${planId}/weeks/${weekId}/sessions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: nextName('Sesion') })
    .expect(201);
  const sessionId = sessionRes.body.data.id as string;

  const exerciseRes = await supertest(http)
    .post('/api/exercises')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: nextName('Ejercicio'),
      description: 'Descripcion de prueba',
      muscleGroup: 'Cuadriceps',
    })
    .expect(201);
  const exerciseId = exerciseRes.body.data.id as string;

  await supertest(http)
    .post(`/api/plans/${planId}/sessions/${sessionId}/exercises`)
    .set('Authorization', `Bearer ${token}`)
    .send({ exerciseId })
    .expect(201);

  await supertest(http)
    .post(`/api/plans/${planId}/publish`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  return planId;
}

async function requestSubscription(
  token: string,
  planId: string,
): Promise<string> {
  const res = await supertest(http)
    .post('/api/subscriptions')
    .set('Authorization', `Bearer ${token}`)
    .send({ planId })
    .expect(201);
  return res.body.data.id as string;
}

// ── POST /subscriptions ─────────────────────────────────────────────────────

describe('POST /api/subscriptions', () => {
  it('CA-012-1 — un atleta solicita inscripcion a un plan Publicado y queda Pendiente', async () => {
    const planId = await buildPublishedPlan(coachToken);

    const response = await supertest(http)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ planId })
      .expect(201);

    expect(response.body.data).toMatchObject({
      planId,
      athleteId,
      status: SubscriptionStatus.PENDING,
    });
  });

  it('rechaza con 400 si planId no es un UUID valido', async () => {
    await supertest(http)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ planId: 'no-es-un-uuid' })
      .expect(400);
  });

  it('rechaza con 401 sin autenticacion', async () => {
    const planId = await buildPublishedPlan(coachToken);

    await supertest(http)
      .post('/api/subscriptions')
      .send({ planId })
      .expect(401);
  });

  it('rechaza con 403 si el usuario autenticado es COACH (CA-012-5)', async () => {
    const planId = await buildPublishedPlan(coachToken);

    await supertest(http)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ planId })
      .expect(403);
  });

  it('rechaza con 403 si el usuario autenticado es ADMIN (CA-012-5)', async () => {
    const planId = await buildPublishedPlan(coachToken);

    await supertest(http)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ planId })
      .expect(403);
  });

  it('rechaza con 404 si el plan no existe', async () => {
    await supertest(http)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ planId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
  });

  it(
    'CA-012-4 — rechaza con 409 PLAN_NOT_PUBLISHED si el plan esta en Borrador, ' +
      'sin crear ninguna fila',
    async () => {
      const planRes = await supertest(http)
        .post('/api/plans')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ name: nextName('Plan Borrador') })
        .expect(201);
      const draftPlanId = planRes.body.data.id as string;

      const response = await supertest(http)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({ planId: draftPlanId })
        .expect(409);
      expect(response.body.errorCode).toBe('PLAN_NOT_PUBLISHED');

      const count = await prisma.subscription.count({
        where: { athleteId, planId: draftPlanId },
      });
      expect(count).toBe(0);
    },
  );

  it(
    'CA-012-2/CA-012-3 — bloquea un reintento mientras exista una suscripcion Pendiente, ' +
      'pero permite reintentar tras un Rechazo',
    async () => {
      const planId = await buildPublishedPlan(coachToken);
      const subscriptionId = await requestSubscription(athleteToken, planId);

      // CA-012-2: reintento mientras esta Pendiente
      const dup = await supertest(http)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({ planId })
        .expect(409);
      expect(dup.body.errorCode).toBe('SUBSCRIPTION_ALREADY_EXISTS');

      // El coach rechaza la solicitud
      await supertest(http)
        .post(`/api/subscriptions/${subscriptionId}/reject`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      // CA-012-3: tras el rechazo, el atleta SI puede volver a solicitar
      const retry = await supertest(http)
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({ planId })
        .expect(201);
      expect(retry.body.data.status).toBe(SubscriptionStatus.PENDING);
    },
  );
});

// ── GET /subscriptions ──────────────────────────────────────────────────────

describe('GET /api/subscriptions', () => {
  it('CA-014-1/CA-014-4 — lista las suscripciones propias del atleta autenticado', async () => {
    const planId = await buildPublishedPlan(coachToken);
    await requestSubscription(athleteToken, planId);

    const response = await supertest(http)
      .get('/api/subscriptions')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toHaveProperty('totalItems');
    const ids = (response.body.data as Array<{ planId: string }>).map(
      (s) => s.planId,
    );
    expect(ids).toContain(planId);
  });

  it('rechaza con 401 sin autenticacion', async () => {
    await supertest(http).get('/api/subscriptions').expect(401);
  });

  it('rechaza con 403 si el usuario autenticado es COACH', async () => {
    await supertest(http)
      .get('/api/subscriptions')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);
  });
});

// ── GET /subscriptions/pending ──────────────────────────────────────────────

describe('GET /api/subscriptions/pending', () => {
  it('CA-013-3 — lista las suscripciones Pendientes de los planes propios del coach, con nombres', async () => {
    const planId = await buildPublishedPlan(coachToken);
    await requestSubscription(athleteToken, planId);

    const response = await supertest(http)
      .get('/api/subscriptions/pending')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const item = (
      response.body.data as Array<{
        planId: string;
        athleteName: string;
        planName: string;
        status: string;
      }>
    ).find((s) => s.planId === planId);
    expect(item).toBeDefined();
    expect(item!.status).toBe(SubscriptionStatus.PENDING);
    expect(item!.athleteName).toBe('Athlete E2E Subscriptions');
  });

  it('rechaza con 401 sin autenticacion', async () => {
    await supertest(http).get('/api/subscriptions/pending').expect(401);
  });

  it('rechaza con 403 si el usuario autenticado es ATHLETE', async () => {
    await supertest(http)
      .get('/api/subscriptions/pending')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  // Hallazgo del ciclo 2 (revision_codigo.yaml): athleteName es de un tercero
  // y ningun id de atleta viaja en la URL — mismo criterio que
  // CoachRequestsController.search (hallazgo #9). @AuditResources('Subscription')
  // debe dejar los IDs devueltos en la fila de auditoria.
  it('deja registrados en audit_logs los IDs de las suscripciones devueltas (@AuditResources)', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    const response = await supertest(http)
      .get('/api/subscriptions/pending')
      .set('Authorization', `Bearer ${coachToken}`)
      .set('User-Agent', AUDIT_AGENT)
      .expect(200);

    const devueltos = (response.body.data as { id: string }[]).map((s) => s.id);
    expect(devueltos).toContain(subscriptionId);

    const fila = await esperarFilaAuditoria({
      url: '/api/subscriptions/pending',
      userId: coachId,
    });

    expect(fila).not.toBeNull();
    expect(fila!.resourceType).toBe('Subscription');
    expect(fila!.resourceIds).toEqual(devueltos);
  });
});

// ── POST /subscriptions/:id/approve ─────────────────────────────────────────

describe('POST /api/subscriptions/:id/approve', () => {
  it('CA-013-1 — el coach propietario del plan aprueba la solicitud (Pendiente -> Aprobada)', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    const response = await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.status).toBe(SubscriptionStatus.APPROVED);
  });

  it('rechaza con 401 sin autenticacion', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .expect(401);
  });

  it('rechaza con 403 si el usuario autenticado es ATHLETE (CA-013-5)', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('rechaza con 404 si la suscripcion no existe', async () => {
    await supertest(http)
      .post('/api/subscriptions/00000000-0000-4000-8000-000000000000/approve')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);
  });

  it('CA-013-4 — rechaza con 403 si el plan de la suscripcion no pertenece al coach autenticado', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${otherCoachToken}`)
      .expect(403);
  });

  it('CA-013-6 — rechaza con 409 si la suscripcion ya fue resuelta previamente', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);
    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(409);
    expect(response.body.errorCode).toBe('INVALID_STATE_TRANSITION');
  });
});

// ── POST /subscriptions/:id/reject ──────────────────────────────────────────

describe('POST /api/subscriptions/:id/reject', () => {
  it('CA-013-2 — el coach propietario del plan rechaza la solicitud (Pendiente -> Rechazada)', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    const response = await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/reject`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.status).toBe(SubscriptionStatus.REJECTED);
  });

  it('rechaza con 401 sin autenticacion', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/reject`)
      .expect(401);
  });

  it('rechaza con 404 si la suscripcion no existe', async () => {
    await supertest(http)
      .post('/api/subscriptions/00000000-0000-4000-8000-000000000000/reject')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);
  });

  it('CA-013-4 — rechaza con 403 si el plan de la suscripcion no pertenece al coach autenticado', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/reject`)
      .set('Authorization', `Bearer ${otherCoachToken}`)
      .expect(403);
  });

  it('CA-013-6 — rechaza con 409 si la suscripcion ya fue resuelta previamente', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);
    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/reject`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/reject`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(409);
  });
});

// ── POST /subscriptions/:id/accept-consent ──────────────────────────────────

describe('POST /api/subscriptions/:id/accept-consent', () => {
  it(
    'CA-014-2 — el atleta titular acepta el consentimiento (Aprobada -> Activa) y ' +
      'queda registrado un LegalAcceptance(SPORT_CONSENT) atomico',
    async () => {
      const planId = await buildPublishedPlan(coachToken);
      const subscriptionId = await requestSubscription(athleteToken, planId);
      await supertest(http)
        .post(`/api/subscriptions/${subscriptionId}/approve`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const response = await supertest(http)
        .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({ documentVersion: '1.0.0' })
        .expect(200);

      expect(response.body.data.status).toBe(SubscriptionStatus.ACTIVE);

      const legalAcceptance = await prisma.legalAcceptance.findFirst({
        where: {
          userId: athleteId,
          planId,
          documentType: DocumentType.SPORT_CONSENT,
        },
      });
      expect(legalAcceptance).not.toBeNull();
      expect(legalAcceptance?.documentVersion).toBe('1.0.0');
    },
  );

  it('rechaza con 400 si documentVersion no viene en el body', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);
    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({})
      .expect(400);
  });

  it('rechaza con 401 sin autenticacion', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
      .send({ documentVersion: '1.0.0' })
      .expect(401);
  });

  it('rechaza con 403 si el usuario autenticado es COACH', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ documentVersion: '1.0.0' })
      .expect(403);
  });

  it('rechaza con 404 si la suscripcion no existe', async () => {
    await supertest(http)
      .post(
        '/api/subscriptions/00000000-0000-4000-8000-000000000000/accept-consent',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ documentVersion: '1.0.0' })
      .expect(404);
  });

  it('CA-014-6 — rechaza con 403 si la suscripcion no es del atleta autenticado (titularidad)', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);
    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
      .set('Authorization', `Bearer ${otherAthleteToken}`)
      .send({ documentVersion: '1.0.0' })
      .expect(403);
  });

  it('rechaza con 409 INVALID_STATE_TRANSITION si la suscripcion todavia esta Pendiente', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);

    const response = await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ documentVersion: '1.0.0' })
      .expect(409);
    expect(response.body.errorCode).toBe('INVALID_STATE_TRANSITION');
  });

  it(
    'CA-014-8 (caso 1 de 2) — rechaza con 409 PLAN_NOT_PUBLISHED si el plan fue Archivado ' +
      'despues de aprobar; la suscripcion permanece en Aprobada, sin LegalAcceptance',
    async () => {
      const planId = await buildPublishedPlan(coachToken);
      const subscriptionId = await requestSubscription(athleteToken, planId);
      await supertest(http)
        .post(`/api/subscriptions/${subscriptionId}/approve`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      await supertest(http)
        .post(`/api/plans/${planId}/archive`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const response = await supertest(http)
        .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({ documentVersion: '1.0.0' })
        .expect(409);
      expect(response.body.errorCode).toBe('PLAN_NOT_PUBLISHED');

      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.APPROVED);
      expect(subscription?.activatedAt).toBeNull();

      const legalAcceptance = await prisma.legalAcceptance.findFirst({
        where: {
          userId: athleteId,
          planId,
          documentType: DocumentType.SPORT_CONSENT,
        },
      });
      expect(legalAcceptance).toBeNull();
    },
  );

  it(
    'CA-014-8 (CASO CRITICO 2 de 2) — rechaza con 409 PLAN_NOT_PUBLISHED cuando el plan ' +
      'tiene status PERSISTIDO todavia en PUBLISHED pero su endDate ya paso, SIN que ' +
      'ningun GET de coach haya disparado el write-through de ' +
      'applyEffectiveStatusWriteThrough — demuestra que el gate evalua el estado ' +
      'EFECTIVO del plan, nunca la columna status en crudo',
    async () => {
      const planId = await buildPublishedPlan(coachToken, {
        startDate: pastDate(60),
        endDate: futureDate(30),
      });
      const subscriptionId = await requestSubscription(athleteToken, planId);
      await supertest(http)
        .post(`/api/subscriptions/${subscriptionId}/approve`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      // Simula el paso del tiempo directamente en la DB, saltandose el
      // service — sin volver a leer el plan como coach (eso dispararia el
      // write-through y lo dejaria en FINALIZED, invalidando el caso que
      // este test busca cubrir).
      await prisma.plan.update({
        where: { id: planId },
        data: { endDate: new Date(pastDate(1)) },
      });

      const response = await supertest(http)
        .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({ documentVersion: '1.0.0' })
        .expect(409);
      expect(response.body.errorCode).toBe('PLAN_NOT_PUBLISHED');

      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.APPROVED);

      // La columna status del plan sigue PUBLISHED — nadie disparo el
      // write-through, confirmando que el gate no dependio de ella.
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      expect(plan?.status).toBe('PUBLISHED');
    },
  );
});

// ── CA-009-7 (EPICA-03) — cerrado end-to-end via hasSubscribers() real ────────

describe('POST /api/plans/:id/unpublish — CA-009-7 (gap de EPICA-03 cerrado en EPICA-04)', () => {
  it('rechaza con 409 PLAN_HAS_SUBSCRIBERS si el plan tiene una suscripcion Aprobada', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);
    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${planId}/unpublish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(409);
    expect(response.body.errorCode).toBe('PLAN_HAS_SUBSCRIBERS');
  });

  it('rechaza con 409 PLAN_HAS_SUBSCRIBERS si el plan tiene una suscripcion Activa', async () => {
    const planId = await buildPublishedPlan(coachToken);
    const subscriptionId = await requestSubscription(athleteToken, planId);
    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
    await supertest(http)
      .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ documentVersion: '1.0.0' })
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${planId}/unpublish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(409);
    expect(response.body.errorCode).toBe('PLAN_HAS_SUBSCRIBERS');
  });

  it('permite despublicar un plan que SOLO tiene suscripciones Pendientes (Pendiente no cuenta como "suscrito")', async () => {
    const planId = await buildPublishedPlan(coachToken);
    await requestSubscription(athleteToken, planId);

    await supertest(http)
      .post(`/api/plans/${planId}/unpublish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
  });
});
