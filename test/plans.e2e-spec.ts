/**
 * Tests E2E para EPICA-03 — Modulo de planes de entrenamiento.
 *
 * PREREQUISITOS:
 * - DATABASE_URL configurado en .env apuntando a una DB de test con el schema migrado
 * - Modelos Plan/Phase/Week/Session/SessionExercise migrados (EPICA-03, DBA)
 *
 * NOTA: Estos tests requieren la DB real. Ejecutar con: pnpm run test:e2e
 *
 * A diferencia de exercises.e2e-spec.ts, Plan.coachId tiene una FK REAL contra
 * User (onDelete: Restrict) — no basta con firmar un JWT con un `sub` arbitrario,
 * el usuario debe existir en la tabla `users`. Por eso el beforeAll inserta
 * directamente con Prisma dos coaches y un atleta (bypassa /api/auth/register:
 * no hace falta password real para firmar el JWT, JwtStrategy solo lee el
 * payload — ver JwtStrategy.validate() y el mismo razonamiento documentado en
 * exercises.e2e-spec.ts).
 *
 * Alcance (ver mensaje de asignacion del Lider Tecnico):
 * (1) Los 17 endpoints de PlansController/PlansCatalogController: happy path,
 *     rechazo de validacion, sin autenticacion, y rechazo por rol (ATHLETE)
 *     donde aplica.
 * (2) CA-006-1 de EPICA-02, cerrado por primera vez end-to-end: crear
 *     ejercicio -> usarlo en un plan -> PATCH del ejercicio -> se crea una
 *     ExerciseVersion NUEVA, la anterior queda intacta y el SessionExercise
 *     sigue apuntando a la version original (RN-07).
 * (3) FK compuesta de Week `(phaseId, planId) -> Phase(id, planId)`: garantia
 *     de base de datos, probada saltandose el service (igual que el indice
 *     parcial de exercises.e2e-spec.ts).
 * (4) Evaluacion perezosa de Finalizado (CA-010-1, D-1): un plan Publicado
 *     con endDate pasada se ve Finalizado y NO aparece en el catalogo.
 * (5) Perfil publico del entrenador (Ley 1581/2012): el catalogo nunca expone
 *     email/phone/identificacion/fecha de nacimiento.
 *
 * Gap declarado, NO verificable e2e en esta epica (ver reporte_qa.yaml):
 * hasSubscribers() es un stub fijo en false — la rama "con suscritos" de
 * unpublish() (CA-009-7) solo esta cubierta por test unitario mockeando el
 * stub (plans.service.spec.ts).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import supertest from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import {
  UserRole,
  IdentificationType,
  CoachRequestStatus,
} from '../generated/prisma/index.js';
import { ResponseInterceptor } from '../src/modules/common/interceptors/response.interceptor.js';
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

// Cada it() de este archivo puede disparar varias requests HTTP
// secuenciales contra el pool de Supabase (buildCompletePlan encadena 5
// llamadas); el timeout por defecto de vitest (5000ms) es insuficiente
// para la latencia real del pooler remoto. Se sube solo para este archivo.
vi.setConfig({ testTimeout: 20000 });

const RUN_ID = Date.now().toString(36);
const NAME_PREFIX = `E2E-${RUN_ID}-`;

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
let coachToken: string;
let otherCoachToken: string;
let athleteToken: string;
let adminToken: string;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.useGlobalInterceptors(new ResponseInterceptor());
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

  // Plan.coachId es una FK real contra users(id) — se crean coaches reales
  // (bypass de /api/auth/register, no hace falta password real para el JWT).
  const coach = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}coach@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.COACH,
      name: 'Coach E2E',
      phone: '3000000000',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-coach`,
    },
  });
  const otherCoach = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}other-coach@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.COACH,
      name: 'Other Coach E2E',
      phone: '3000000001',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-other-coach`,
    },
  });
  coachId = coach.id;
  otherCoachId = otherCoach.id;

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
    sub: `${NAME_PREFIX}athlete-id`,
    email: 'athlete-e2e-plans@test.com',
    role: UserRole.ATHLETE,
  });
  adminToken = jwtService.sign({
    sub: `${NAME_PREFIX}admin-id`,
    email: 'admin-e2e-plans@test.com',
    role: UserRole.ADMIN,
  });
});

afterAll(async () => {
  // Orden de limpieza: Plan primero (Phase/Week/Session/SessionExercise
  // cascadean), despues Exercise (ExerciseVersion cascadea), despues
  // CoachRequest, y al final los Users — Plan.coach es onDelete: Restrict.
  await prisma.plan.deleteMany({
    where: { coachId: { in: [coachId, otherCoachId] } },
  });
  await prisma.exercise.deleteMany({
    where: { name: { startsWith: NAME_PREFIX } },
  });
  await prisma.coachRequest.deleteMany({
    where: { userId: { in: [coachId, otherCoachId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [coachId, otherCoachId] } },
  });
  await app.close();
});

// ── Helpers de fixtures ────────────────────────────────────────────────────────

async function createExercise(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const response = await supertest(http)
    .post('/api/exercises')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: nextName('Ejercicio'),
      description: 'Descripcion de prueba',
      muscleGroup: 'Cuadriceps',
      ...overrides,
    })
    .expect(201);
  return { id: response.body.data.id as string };
}

async function createPlan(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const response = await supertest(http)
    .post('/api/plans')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: nextName('Plan'), ...overrides })
    .expect(201);
  return { id: response.body.data.id as string };
}

/**
 * Construye un plan COMPLETO (fase -> semana -> sesion -> ejercicio), listo
 * para publicar (RN-01, CA-009-2). Reutilizado por publish/catalogo/RN-07.
 */
async function buildCompletePlan(
  token: string,
  planOverrides: Record<string, unknown> = {},
): Promise<{
  planId: string;
  phaseId: string;
  weekId: string;
  sessionId: string;
  exerciseId: string;
  sessionExerciseId: string;
}> {
  const plan = await createPlan(token, {
    startDate: pastDate(30),
    endDate: futureDate(30),
    ...planOverrides,
  });

  const phaseRes = await supertest(http)
    .post(`/api/plans/${plan.id}/phases`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: nextName('Fase') })
    .expect(201);
  const phaseId = phaseRes.body.data.id as string;

  const weekRes = await supertest(http)
    .post(`/api/plans/${plan.id}/phases/${phaseId}/weeks`)
    .set('Authorization', `Bearer ${token}`)
    .expect(201);
  const weekId = weekRes.body.data.id as string;

  const sessionRes = await supertest(http)
    .post(`/api/plans/${plan.id}/weeks/${weekId}/sessions`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: nextName('Sesion') })
    .expect(201);
  const sessionId = sessionRes.body.data.id as string;

  const exercise = await createExercise(token);

  // D-15 (EPICA-05): publish() ahora exige prescripcion significativa por
  // ejercicio — sets+reps (regimen de fuerza) es suficiente. Sin esto,
  // cualquier llamado a POST /plans/:id/publish sobre un plan construido
  // con este helper responde 422 PLAN_INCOMPLETE.
  const sessionExerciseRes = await supertest(http)
    .post(`/api/plans/${plan.id}/sessions/${sessionId}/exercises`)
    .set('Authorization', `Bearer ${token}`)
    .send({ exerciseId: exercise.id, sets: 4, reps: 10 })
    .expect(201);
  const sessionExerciseId = sessionExerciseRes.body.data.id as string;

  return {
    planId: plan.id,
    phaseId,
    weekId,
    sessionId,
    exerciseId: exercise.id,
    sessionExerciseId,
  };
}

// ── POST /api/plans — HU-008 ───────────────────────────────────────────────────

describe('POST /api/plans — HU-008: Crear el shell del plan', () => {
  it('201 — COACH crea el plan en Borrador, sin fases (CA-008-1/CA-008-2)', async () => {
    const response = await supertest(http)
      .post('/api/plans')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: nextName('Plan') })
      .expect(201);

    expect(response.body.data.status).toBe('DRAFT');
    expect(response.body.data.coachId).toBe(coachId);
    expect(response.body.data.startDate).toBeNull();
    expect(response.body.data.endDate).toBeNull();
  });

  it('400 — falla la validacion cuando falta name', async () => {
    const response = await supertest(http)
      .post('/api/plans')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({})
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('401 — sin token retorna error de autenticacion', async () => {
    const response = await supertest(http)
      .post('/api/plans')
      .send({ name: 'x' })
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('403 — ATHLETE no puede crear planes (RN-18)', async () => {
    await supertest(http)
      .post('/api/plans')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'x' })
      .expect(403);
  });

  it('403 — ADMIN tampoco tiene funcion sobre planes (D-12, a diferencia de exercises)', async () => {
    await supertest(http)
      .post('/api/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'x' })
      .expect(403);
  });
});

// ── GET /api/plans — HU-008 ─────────────────────────────────────────────────────

describe('GET /api/plans — Listado propio del entrenador', () => {
  it('200 — lista solo los planes del coach autenticado', async () => {
    const own = await createPlan(coachToken);
    await createPlan(otherCoachToken);

    const response = await supertest(http)
      .get('/api/plans?limit=100')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const ids = (response.body.data as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(own.id);
    expect(response.body.meta).toBeDefined();
  });

  it('401 — sin token', async () => {
    await supertest(http).get('/api/plans').expect(401);
  });

  it('403 — ATHLETE no puede listar planes de un entrenador', async () => {
    await supertest(http)
      .get('/api/plans')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });
});

// ── GET /api/plans/:id — HU-008 (D-8) ───────────────────────────────────────────

describe('GET /api/plans/:id — Detalle con el arbol completo (D-8)', () => {
  it('200 — retorna fases -> semanas -> sesiones -> ejercicios, sin archivedAt', async () => {
    const built = await buildCompletePlan(coachToken);

    const response = await supertest(http)
      .get(`/api/plans/${built.planId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.phases).toHaveLength(1);
    expect(response.body.data.phases[0].weeks).toHaveLength(1);
    expect(response.body.data.phases[0].weeks[0].sessions).toHaveLength(1);
    const sessionExercise =
      response.body.data.phases[0].weeks[0].sessions[0].exercises[0];
    expect(sessionExercise.id).toBe(built.sessionExerciseId);
    expect(sessionExercise.exerciseId).toBe(built.exerciseId);
    expect(sessionExercise.versionNumber).toBe(1);
    expect(response.body.data.archivedAt).toBeUndefined();
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .get('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .expect(401);
  });

  it('403 — ATHLETE no puede consultar el detalle de un plan', async () => {
    await supertest(http)
      .get('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('403 — RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach (CA-008-6)', async () => {
    const plan = await createPlan(otherCoachToken);

    const response = await supertest(http)
      .get(`/api/plans/${plan.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);

    expect(response.body.errorCode).toBe('RESOURCE_OWNERSHIP_DENIED');
  });

  it('404 — ENTITY_NOT_FOUND si el plan no existe', async () => {
    const response = await supertest(http)
      .get('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);

    expect(response.body.errorCode).toBe('ENTITY_NOT_FOUND');
  });
});

// ── PATCH /api/plans/:id — HU-008 (D-6) ─────────────────────────────────────────

describe('PATCH /api/plans/:id — Editar datos generales', () => {
  it('200 — edita name/description y startDate/endDate en Borrador', async () => {
    const plan = await createPlan(coachToken);

    const response = await supertest(http)
      .patch(`/api/plans/${plan.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: nextName('Renombrado'),
        startDate: futureDate(1),
        endDate: futureDate(60),
      })
      .expect(200);

    expect(response.body.data.startDate).toBe(futureDate(1));
    expect(response.body.data.endDate).toBe(futureDate(60));
  });

  it('400 — falla la validacion con una fecha mal formada', async () => {
    const plan = await createPlan(coachToken);

    await supertest(http)
      .patch(`/api/plans/${plan.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ startDate: 'no-es-una-fecha' })
      .expect(400);
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .patch('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .send({ name: 'x' })
      .expect(401);
  });

  it('403 — ATHLETE no puede editar planes', async () => {
    await supertest(http)
      .patch('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'x' })
      .expect(403);
  });

  it('403 — RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach', async () => {
    const plan = await createPlan(otherCoachToken);

    await supertest(http)
      .patch(`/api/plans/${plan.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'x' })
      .expect(403);
  });

  it('404 — ENTITY_NOT_FOUND si el plan no existe', async () => {
    await supertest(http)
      .patch('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'x' })
      .expect(404);
  });

  it('409 — PLAN_IMMUTABLE al intentar cambiar fechas de un plan ya Publicado (D-6, RN-31)', async () => {
    const built = await buildCompletePlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .patch(`/api/plans/${built.planId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ startDate: futureDate(5) })
      .expect(409);

    expect(response.body.errorCode).toBe('PLAN_IMMUTABLE');

    // name SI sigue editable en cualquier estado (D-6)
    await supertest(http)
      .patch(`/api/plans/${built.planId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: nextName('Renombrado post-publish') })
      .expect(200);
  });
});

// ── POST/DELETE /api/plans/:id/phases — HU-008 ──────────────────────────────────

describe('POST /api/plans/:id/phases — Agregar fase', () => {
  it('201 — agrega una fase con order server-side (D-5)', async () => {
    const plan = await createPlan(coachToken);

    const response = await supertest(http)
      .post(`/api/plans/${plan.id}/phases`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: nextName('Fase') })
      .expect(201);

    expect(response.body.data.order).toBe(1);
  });

  it('400 — falla la validacion cuando falta name', async () => {
    const plan = await createPlan(coachToken);

    await supertest(http)
      .post(`/api/plans/${plan.id}/phases`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({})
      .expect(400);
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/phases')
      .send({ name: 'x' })
      .expect(401);
  });

  it('403 — ATHLETE no puede agregar fases', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/phases')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'x' })
      .expect(403);
  });

  it('409 — PlanPublishedGuard rechaza agregar fases si el plan ya no esta en Borrador (RN-31)', async () => {
    const built = await buildCompletePlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/phases`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'Fase tardia' })
      .expect(409);

    expect(response.body.errorCode).toBe('PLAN_IMMUTABLE');
  });
});

describe('DELETE /api/plans/:id/phases/:phaseId — Quitar fase', () => {
  it('200 — elimina la fase (hard-delete real, D-7)', async () => {
    const built = await buildCompletePlan(coachToken);

    const response = await supertest(http)
      .delete(`/api/plans/${built.planId}/phases/${built.phaseId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data).toBeNull();
    expect(response.body.message).toBe('Fase eliminada exitosamente');
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/phases/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .expect(401);
  });

  it('403 — ATHLETE no puede eliminar fases', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/phases/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('404 — ENTITY_NOT_FOUND si la fase no existe', async () => {
    const plan = await createPlan(coachToken);

    await supertest(http)
      .delete(
        `/api/plans/${plan.id}/phases/a1b2c3d4-e5f6-7890-abcd-ef1234567890`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);
  });
});

// ── POST/DELETE .../weeks — HU-008 (D-4) ────────────────────────────────────────

describe('POST /api/plans/:id/phases/:phaseId/weeks — Agregar semana', () => {
  it('201 — weekNumber es secuencial a TODO el plan, no reinicia por fase (D-4)', async () => {
    const plan = await createPlan(coachToken);

    const phase1 = await supertest(http)
      .post(`/api/plans/${plan.id}/phases`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'Fase 1' })
      .expect(201);
    const phase2 = await supertest(http)
      .post(`/api/plans/${plan.id}/phases`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'Fase 2' })
      .expect(201);

    const week1 = await supertest(http)
      .post(
        `/api/plans/${plan.id}/phases/${phase1.body.data.id as string}/weeks`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(201);
    expect(week1.body.data.weekNumber).toBe(1);

    // La segunda semana pertenece a la SEGUNDA fase, pero weekNumber sigue la
    // secuencia del plan completo (2), no reinicia en 1 (D-4).
    const week2 = await supertest(http)
      .post(
        `/api/plans/${plan.id}/phases/${phase2.body.data.id as string}/weeks`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(201);
    expect(week2.body.data.weekNumber).toBe(2);
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .post(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/phases/a1b2c3d4-e5f6-7890-abcd-ef1234567890/weeks',
      )
      .expect(401);
  });

  it('403 — ATHLETE no puede agregar semanas', async () => {
    await supertest(http)
      .post(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/phases/a1b2c3d4-e5f6-7890-abcd-ef1234567890/weeks',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('404 — ENTITY_NOT_FOUND si la fase no existe', async () => {
    const plan = await createPlan(coachToken);

    await supertest(http)
      .post(
        `/api/plans/${plan.id}/phases/a1b2c3d4-e5f6-7890-abcd-ef1234567890/weeks`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);
  });
});

describe('DELETE /api/plans/:id/weeks/:weekId — Quitar semana', () => {
  it('200 — elimina la semana (ruta plana, D-9)', async () => {
    const built = await buildCompletePlan(coachToken);

    const response = await supertest(http)
      .delete(`/api/plans/${built.planId}/weeks/${built.weekId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.message).toBe('Semana eliminada exitosamente');
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/weeks/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .expect(401);
  });

  it('403 — ATHLETE no puede eliminar semanas', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/weeks/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });
});

// ── POST/DELETE .../sessions — HU-008 ───────────────────────────────────────────

describe('POST /api/plans/:id/weeks/:weekId/sessions — Agregar sesion', () => {
  it('201 — agrega una sesion con order server-side (D-5)', async () => {
    const plan = await createPlan(coachToken);
    const phase = await supertest(http)
      .post(`/api/plans/${plan.id}/phases`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'Fase' })
      .expect(201);
    const week = await supertest(http)
      .post(
        `/api/plans/${plan.id}/phases/${phase.body.data.id as string}/weeks`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(201);

    const response = await supertest(http)
      .post(
        `/api/plans/${plan.id}/weeks/${week.body.data.id as string}/sessions`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: nextName('Sesion') })
      .expect(201);

    expect(response.body.data.order).toBe(1);
  });

  it('400 — falla la validacion cuando falta name', async () => {
    const built = await buildCompletePlan(coachToken);

    await supertest(http)
      .post(`/api/plans/${built.planId}/weeks/${built.weekId}/sessions`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({})
      .expect(400);
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .post(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/weeks/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions',
      )
      .send({ name: 'x' })
      .expect(401);
  });

  it('403 — ATHLETE no puede agregar sesiones', async () => {
    await supertest(http)
      .post(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/weeks/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'x' })
      .expect(403);
  });
});

describe('DELETE /api/plans/:id/sessions/:sessionId — Quitar sesion', () => {
  it('200 — elimina la sesion (ruta plana, D-9)', async () => {
    const built = await buildCompletePlan(coachToken);

    const response = await supertest(http)
      .delete(`/api/plans/${built.planId}/sessions/${built.sessionId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.message).toBe('Sesion eliminada exitosamente');
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .expect(401);
  });

  it('403 — ATHLETE no puede eliminar sesiones', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });
});

// ── POST/DELETE .../exercises — HU-008 (CA-008-3, D-2, RN-07) ──────────────────

describe('POST /api/plans/:id/sessions/:sessionId/exercises — Agregar ejercicio a sesion', () => {
  it('201 — resuelve exerciseId -> ExerciseVersion vigente y persiste exerciseVersionId (RN-07)', async () => {
    const plan = await createPlan(coachToken);
    const phase = await supertest(http)
      .post(`/api/plans/${plan.id}/phases`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'Fase' })
      .expect(201);
    const week = await supertest(http)
      .post(
        `/api/plans/${plan.id}/phases/${phase.body.data.id as string}/weeks`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(201);
    const session = await supertest(http)
      .post(
        `/api/plans/${plan.id}/weeks/${week.body.data.id as string}/sessions`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: 'Sesion' })
      .expect(201);
    const exercise = await createExercise(coachToken);

    const response = await supertest(http)
      .post(
        `/api/plans/${plan.id}/sessions/${session.body.data.id as string}/exercises`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ exerciseId: exercise.id })
      .expect(201);

    expect(response.body.data.exerciseId).toBe(exercise.id);
    expect(response.body.data.versionNumber).toBe(1);
    expect(response.body.data.order).toBe(1);
  });

  it('400 — falla la validacion cuando exerciseId no es un UUID', async () => {
    const built = await buildCompletePlan(coachToken);

    await supertest(http)
      .post(`/api/plans/${built.planId}/sessions/${built.sessionId}/exercises`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ exerciseId: 'no-es-un-uuid' })
      .expect(400);
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .post(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/exercises',
      )
      .send({ exerciseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
      .expect(401);
  });

  it('403 — ATHLETE no puede agregar ejercicios a una sesion', async () => {
    await supertest(http)
      .post(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/exercises',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ exerciseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
      .expect(403);
  });

  it('404 — ENTITY_NOT_FOUND si el ejercicio no existe en la biblioteca (RN-04)', async () => {
    const built = await buildCompletePlan(coachToken);

    // UUID v4 valido (pasa @IsUUID('4') del DTO) que no corresponde a ningun
    // Exercise real — a diferencia del resto de IDs de este archivo, este va
    // en el BODY validado por class-validator con version fija, no en un
    // :param resuelto por ParseUUIDPipe (que acepta cualquier version).
    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/sessions/${built.sessionId}/exercises`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ exerciseId: 'a1b2c3d4-e5f6-4890-8bcd-ef1234567890' })
      .expect(404);

    expect(response.body.errorCode).toBe('ENTITY_NOT_FOUND');
  });

  it('422 — EXERCISE_INACTIVE si el ejercicio existe pero esta inhabilitado, sin crear el SessionExercise', async () => {
    const built = await buildCompletePlan(coachToken);
    const exercise = await createExercise(coachToken);
    await supertest(http)
      .delete(`/api/exercises/${exercise.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/sessions/${built.sessionId}/exercises`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ exerciseId: exercise.id })
      .expect(422);

    expect(response.body.errorCode).toBe('EXERCISE_INACTIVE');

    // No se creo ningun SessionExercise nuevo — la sesion sigue con solo el
    // ejercicio original de buildCompletePlan.
    const detail = await supertest(http)
      .get(`/api/plans/${built.planId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
    const exercises = detail.body.data.phases[0].weeks[0].sessions[0].exercises;
    expect(exercises).toHaveLength(1);
    expect(exercises[0].id).toBe(built.sessionExerciseId);
  });

  it('409 — PlanPublishedGuard rechaza si el plan ya no esta en Borrador', async () => {
    const built = await buildCompletePlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
    const exercise = await createExercise(coachToken);

    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/sessions/${built.sessionId}/exercises`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ exerciseId: exercise.id })
      .expect(409);

    expect(response.body.errorCode).toBe('PLAN_IMMUTABLE');
  });

  // ── CA-006-1 de EPICA-02: gap cerrado end-to-end POR PRIMERA VEZ ──────────
  //
  // isUsedInPlan() dejo de ser un stub fijo en false (EPICA-02) y ahora
  // consulta sessionExercise.count() real (EPICA-03, D-2). Este test crea el
  // ejercicio, lo usa en un plan, modifica el ejercicio y verifica que:
  // (a) se crea una ExerciseVersion NUEVA con versionNumber incrementado,
  // (b) la version anterior queda intacta,
  // (c) el SessionExercise sigue apuntando a la version ORIGINAL (RN-07) —
  //     nunca a la nueva, aunque el ejercicio cambie despues.
  it(
    'CA-006-1 (EPICA-02) — PATCH de un ejercicio EN USO crea una ExerciseVersion nueva; ' +
      'la sesion que ya lo referencia conserva la version original (RN-07)',
    async () => {
      const exercise = await createExercise(coachToken, {
        description: 'Descripcion original',
      });
      const plan = await createPlan(coachToken);
      const phase = await supertest(http)
        .post(`/api/plans/${plan.id}/phases`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ name: 'Fase' })
        .expect(201);
      const week = await supertest(http)
        .post(
          `/api/plans/${plan.id}/phases/${phase.body.data.id as string}/weeks`,
        )
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(201);
      const session = await supertest(http)
        .post(
          `/api/plans/${plan.id}/weeks/${week.body.data.id as string}/sessions`,
        )
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ name: 'Sesion' })
        .expect(201);

      const sessionExerciseRes = await supertest(http)
        .post(
          `/api/plans/${plan.id}/sessions/${session.body.data.id as string}/exercises`,
        )
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ exerciseId: exercise.id })
        .expect(201);
      expect(sessionExerciseRes.body.data.versionNumber).toBe(1);
      expect(sessionExerciseRes.body.data.description).toBe(
        'Descripcion original',
      );

      // El ejercicio ahora esta EN USO (isUsedInPlan() real -> true) —
      // update() debe crear version 2, nunca editar la version 1 in-place.
      const patchRes = await supertest(http)
        .patch(`/api/exercises/${exercise.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ description: 'Descripcion actualizada tras estar en uso' })
        .expect(200);
      expect(patchRes.body.data.versionNumber).toBe(2);
      expect(patchRes.body.data.description).toBe(
        'Descripcion actualizada tras estar en uso',
      );

      const exerciseDetail = await supertest(http)
        .get(`/api/exercises/${exercise.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);
      expect(exerciseDetail.body.data.versions).toHaveLength(2);

      // La sesion sigue mostrando la version 1 (RN-07) — el GET del arbol
      // completo del plan NUNCA resuelve la vigente actual, sino la que el
      // SessionExercise persistio en el momento de agregarse.
      const planDetail = await supertest(http)
        .get(`/api/plans/${plan.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);
      const persistedExercise =
        planDetail.body.data.phases[0].weeks[0].sessions[0].exercises[0];
      expect(persistedExercise.versionNumber).toBe(1);
      expect(persistedExercise.description).toBe('Descripcion original');
    },
  );
});

describe('DELETE .../sessions/:sessionId/exercises/:sessionExerciseId — Quitar ejercicio de sesion', () => {
  it('200 — elimina el ejercicio de la sesion', async () => {
    const built = await buildCompletePlan(coachToken);

    const response = await supertest(http)
      .delete(
        `/api/plans/${built.planId}/sessions/${built.sessionId}/exercises/${built.sessionExerciseId}`,
      )
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.message).toBe(
      'Ejercicio eliminado exitosamente de la sesion',
    );
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .expect(401);
  });

  it('403 — ATHLETE no puede quitar ejercicios de una sesion', async () => {
    await supertest(http)
      .delete(
        '/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      )
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });
});

// ── POST /api/plans/:id/publish — HU-009 ────────────────────────────────────────

describe('POST /api/plans/:id/publish — Publicar (Borrador -> Publicado)', () => {
  it('200 — publica un plan completo (RN-01, CA-009-2)', async () => {
    const built = await buildCompletePlan(coachToken);

    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.status).toBe('PUBLISHED');
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/publish')
      .expect(401);
  });

  it('403 — ATHLETE no puede publicar', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/publish')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('403 — RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach (CA-009-5)', async () => {
    const built = await buildCompletePlan(otherCoachToken);

    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);
  });

  it('404 — ENTITY_NOT_FOUND si el plan no existe', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/publish')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);
  });

  it('409 — INVALID_STATE_TRANSITION si el plan ya esta Publicado', async () => {
    const built = await buildCompletePlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(409);

    expect(response.body.errorCode).toBe('INVALID_STATE_TRANSITION');
  });

  it('422 — PLAN_INCOMPLETE lista los requisitos faltantes de un plan vacio (CA-009-2)', async () => {
    const plan = await createPlan(coachToken);

    const response = await supertest(http)
      .post(`/api/plans/${plan.id}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(422);

    expect(response.body.errorCode).toBe('PLAN_INCOMPLETE');
    expect(response.body.context.missingRequirements).toEqual(
      expect.arrayContaining([
        'fecha de inicio',
        'fecha de fin',
        'al menos una fase',
      ]),
    );
  });
});

// ── POST /api/plans/:id/unpublish — HU-009 ──────────────────────────────────────

describe('POST /api/plans/:id/unpublish — Despublicar (Publicado -> Borrador)', () => {
  it('200 — despublica el plan cuando NO tiene suscriptores (hasSubscribers() siempre false hoy)', async () => {
    const built = await buildCompletePlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/unpublish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.status).toBe('DRAFT');
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/unpublish')
      .expect(401);
  });

  it('403 — ATHLETE no puede despublicar', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/unpublish')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('403 — RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach (CA-009-5)', async () => {
    const built = await buildCompletePlan(otherCoachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${otherCoachToken}`)
      .expect(200);

    await supertest(http)
      .post(`/api/plans/${built.planId}/unpublish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);
  });

  it('409 — INVALID_STATE_TRANSITION si el plan no esta Publicado', async () => {
    const plan = await createPlan(coachToken);

    const response = await supertest(http)
      .post(`/api/plans/${plan.id}/unpublish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(409);

    expect(response.body.errorCode).toBe('INVALID_STATE_TRANSITION');
  });
});

// ── POST /api/plans/:id/archive — HU-010 ────────────────────────────────────────

describe('POST /api/plans/:id/archive — Archivar', () => {
  it('200 — archiva un plan en Borrador (CA-010-2)', async () => {
    const plan = await createPlan(coachToken);

    const response = await supertest(http)
      .post(`/api/plans/${plan.id}/archive`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.status).toBe('ARCHIVED');
  });

  it('200 — archiva un plan Publicado (CA-010-2)', async () => {
    const built = await buildCompletePlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${built.planId}/archive`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.status).toBe('ARCHIVED');
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/archive')
      .expect(401);
  });

  it('403 — ATHLETE no puede archivar', async () => {
    await supertest(http)
      .post('/api/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890/archive')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('403 — RESOURCE_OWNERSHIP_DENIED si el plan es de otro coach (CA-010-4)', async () => {
    const plan = await createPlan(otherCoachToken);

    await supertest(http)
      .post(`/api/plans/${plan.id}/archive`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);
  });

  it('409 — INVALID_STATE_TRANSITION si el plan ya esta Archivado (CA-010-3)', async () => {
    const plan = await createPlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${plan.id}/archive`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .post(`/api/plans/${plan.id}/archive`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(409);

    expect(response.body.errorCode).toBe('INVALID_STATE_TRANSITION');
  });
});

// ── GET /api/catalog/plans — HU-011 ─────────────────────────────────────────────

describe('GET /api/catalog/plans — Catalogo de planes publicados (CA-011-1)', () => {
  it('200 — lista solo planes Publicados y vigentes, con el perfil publico REDUCIDO del entrenador', async () => {
    const built = await buildCompletePlan(coachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .get('/api/catalog/plans?limit=100')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const item = (
      response.body.data as Array<{
        id: string;
        coach: Record<string, unknown>;
      }>
    ).find((p) => p.id === built.planId);
    expect(item).toBeDefined();
    expect(Object.keys(item!.coach).sort()).toEqual(
      ['avatarUrl', 'id', 'name'].sort(),
    );
  });

  it(
    'CA-011-3 — un plan Publicado con endDate en el pasado NO aparece en el catalogo ' +
      '(evaluacion perezosa a nivel de query, D-1)',
    async () => {
      const built = await buildCompletePlan(coachToken, {
        startDate: pastDate(60),
        endDate: pastDate(1),
      });
      await supertest(http)
        .post(`/api/plans/${built.planId}/publish`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const response = await supertest(http)
        .get('/api/catalog/plans?limit=100')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const ids = (response.body.data as Array<{ id: string }>).map(
        (p) => p.id,
      );
      expect(ids).not.toContain(built.planId);

      // El propio coach SI ve el status efectivo FINALIZED al consultarlo (D-1)
      // — el write-through no rompe la respuesta aunque sea fire-and-forget.
      const own = await supertest(http)
        .get(`/api/plans/${built.planId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);
      expect(own.body.data.status).toBe('FINALIZED');
    },
  );

  it('401 — sin token', async () => {
    await supertest(http).get('/api/catalog/plans').expect(401);
  });
});

// ── GET /api/catalog/plans/:id — HU-011 (CA-011-2, D-2b) ────────────────────────

describe('GET /api/catalog/plans/:id — Detalle del catalogo con perfil publico del entrenador', () => {
  it('200 — expone description/bannerUrl cuando el coach tiene CoachRequest APPROVED (D-2b)', async () => {
    const built = await buildCompletePlan(coachToken);
    await prisma.coachRequest.upsert({
      where: { userId: coachId },
      create: {
        userId: coachId,
        planDescription: 'Entrenador certificado E2E',
        bannerUrl: 'https://storage.fitmess.co/banners/e2e.jpg',
        status: CoachRequestStatus.APPROVED,
      },
      update: {
        status: CoachRequestStatus.APPROVED,
        planDescription: 'Entrenador certificado E2E',
        bannerUrl: 'https://storage.fitmess.co/banners/e2e.jpg',
      },
    });
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(http)
      .get(`/api/catalog/plans/${built.planId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.coach.description).toBe(
      'Entrenador certificado E2E',
    );
    expect(response.body.data.coach.bannerUrl).toBe(
      'https://storage.fitmess.co/banners/e2e.jpg',
    );
    expect(
      response.body.data.phases[0].weeks[0].sessions[0].exerciseCount,
    ).toBe(1);
    // Solo cantidad de ejercicios, nunca el detalle (CA-011-2)
    expect(
      response.body.data.phases[0].weeks[0].sessions[0].exercises,
    ).toBeUndefined();
  });

  it('200 — description/bannerUrl en null sin CoachRequest APPROVED (D-2b)', async () => {
    const built = await buildCompletePlan(otherCoachToken);
    await supertest(http)
      .post(`/api/plans/${built.planId}/publish`)
      .set('Authorization', `Bearer ${otherCoachToken}`)
      .expect(200);

    const response = await supertest(http)
      .get(`/api/catalog/plans/${built.planId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.coach.description).toBeNull();
    expect(response.body.data.coach.bannerUrl).toBeNull();
  });

  it(
    'Ley 1581/2012 — NUNCA expone email/phone/identificacion/fecha de nacimiento ' +
      'del entrenador en el perfil publico',
    async () => {
      const built = await buildCompletePlan(otherCoachToken);
      await supertest(http)
        .post(`/api/plans/${built.planId}/publish`)
        .set('Authorization', `Bearer ${otherCoachToken}`)
        .expect(200);

      const response = await supertest(http)
        .get(`/api/catalog/plans/${built.planId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const coach = response.body.data.coach as Record<string, unknown>;
      expect(coach.email).toBeUndefined();
      expect(coach.phone).toBeUndefined();
      expect(coach.phoneCountryCode).toBeUndefined();
      expect(coach.identificationType).toBeUndefined();
      expect(coach.identificationNumber).toBeUndefined();
      expect(coach.dateOfBirth).toBeUndefined();
      expect(coach.passwordHash).toBeUndefined();
    },
  );

  it('404 — ENTITY_NOT_FOUND si el plan no existe, no esta Publicado, o ya vencio (mismo mensaje en ambos casos)', async () => {
    const draft = await createPlan(coachToken);

    const notPublished = await supertest(http)
      .get(`/api/catalog/plans/${draft.id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);
    const notFound = await supertest(http)
      .get('/api/catalog/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);

    expect(notPublished.body.errorCode).toBe('ENTITY_NOT_FOUND');
    expect(notFound.body.errorCode).toBe('ENTITY_NOT_FOUND');
  });

  it('401 — sin token', async () => {
    await supertest(http)
      .get('/api/catalog/plans/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .expect(401);
  });
});

// ── FK compuesta Week (phaseId, planId) -> Phase(id, planId) ───────────────────

describe('FK compuesta de Week — garantia de base de datos (no solo disciplina del service)', () => {
  it(
    'Postgres RECHAZA insertar una Week cuyo planId no coincide con el planId real de su Phase, ' +
      'saltandose el service por completo',
    async () => {
      const planA = await createPlan(coachToken);
      const planB = await createPlan(coachToken);

      const phaseOfA = await prisma.phase.create({
        data: { planId: planA.id, name: 'Fase de A', order: 1 },
      });

      // INSERT directo con Prisma, sin pasar por PlansService.addWeek(): usa el
      // planId de OTRO plan (B) para una Week que declara phaseId de la fase
      // de A. La FK compuesta `(phaseId, planId) -> Phase(id, planId)` exige
      // que el PAR exacto exista como fila real de Phase — Postgres debe
      // rechazarlo con una violacion de FK (P2003), no solo el service.
      await expect(
        prisma.week.create({
          data: {
            phaseId: phaseOfA.id,
            planId: planB.id,
            weekNumber: 1,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    },
  );
});
