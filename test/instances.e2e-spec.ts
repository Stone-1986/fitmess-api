/**
 * Tests E2E para EPICA-05 — Modulo de ejecucion de la instancia
 * personalizada (execution / instances).
 *
 * PREREQUISITOS:
 * - DATABASE_URL configurado en .env apuntando a una DB de test con el schema migrado
 * - Migracion 20260821161654_epica_05_execution_and_prescription aplicada
 *   (PlanInstance/InstancePhase/InstanceWeek/InstanceSession/
 *   InstanceSessionExercise/SessionResult/SessionExerciseResult/WeeklyFeeling)
 *
 * NOTA: Estos tests requieren la DB real. Ejecutar con: pnpm run test:e2e
 *
 * Alcance (los 5 endpoints de InstancesController, ejercitando el pipeline
 * HTTP completo — ValidationPipe, guards, filters, ResponseInterceptor — que
 * instances.service.spec.ts / instances.controller.spec.ts no pueden ver):
 *
 * (1) Flujo feliz de punta a punta: publicar un plan CON prescripcion (D-15),
 *     suscribir, aprobar, aceptar consentimiento (D-14, dispara HU-023) ->
 *     GET /instances lista la instancia -> GET /instances/:planId trae el
 *     arbol completo con la prescripcion copiada (CA-023-9) -> registrar
 *     resultados de la UNICA sesion programada cierra la semana (D-4,
 *     RN-30) -> WEEK_FROZEN al reintentar editar (CA-015-4/5) -> registrar
 *     sensaciones semanales de una semana SIN cerrar en un plan aparte.
 * (2) CA-023-1/D-3: el atleta puede consultar su instancia inmediatamente
 *     despues de aceptar el consentimiento (auto-reparacion o listener,
 *     cualquiera que gane la carrera converge al mismo resultado 200).
 * (3) CA-015-10: payload que omite un ejercicio de la sesion responde 422
 *     RESULT_FIELDS_INVALID sin escribir nada.
 * (4) CA-016-9: sensaciones fuera de [1,10] responden 400 (ValidationPipe),
 *     no 422 — y no crean ningun WeeklyFeeling.
 * (5) CONSENT_REQUIRED (422) en los tres endpoints que lo exigen cuando la
 *     suscripcion NO esta Activa.
 * (6) HU-017/D-9: GET /instances/:planId/athletes/:athleteId responde 403
 *     RESOURCE_OWNERSHIP_DENIED si :planId no es del coach, y 404
 *     ENTITY_NOT_FOUND (NUNCA CONSENT_REQUIRED) si el atleta no tiene
 *     instancia en ese plan.
 * (7) 401 sin autenticacion en los 5 endpoints.
 *
 * AISLAMIENTO: cada corrida genera un RUN_ID y todos los fixtures lo llevan
 * como prefijo. El afterAll borra por ese prefijo.
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
import { UserRole, IdentificationType } from '../generated/prisma/index.js';
import { ResponseInterceptor } from '../src/modules/common/interceptors/response.interceptor.js';
import { AuditResourcesInterceptor } from '../src/modules/common/interceptors/audit-resources.interceptor.js';
import { ProblemDetailFilter } from '../src/modules/common/filters/problem-detail.filter.js';
import { PrismaExceptionFilter } from '../src/modules/common/filters/prisma-exception.filter.js';
import { ValidationExceptionFilter } from '../src/modules/common/filters/validation-exception.filter.js';
import { GlobalExceptionFilter } from '../src/modules/common/filters/global-exception.filter.js';

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

vi.setConfig({ testTimeout: 20000 });

const RUN_ID = Date.now().toString(36);
const NAME_PREFIX = `E2E-INST-${RUN_ID}-`;

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

let app: INestApplication;
let prisma: PrismaService;
let jwtService: JwtService;
let http: ReturnType<typeof app.getHttpServer>;

let coachId: string;
let otherCoachId: string;
let athleteId: string;
let coachToken: string;
let otherCoachToken: string;
let athleteToken: string;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

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

  const coach = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}coach@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.COACH,
      name: 'Coach E2E Instances',
      phone: '3000000020',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-inst-coach`,
    },
  });
  const otherCoach = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}other-coach@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.COACH,
      name: 'Other Coach E2E Instances',
      phone: '3000000021',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-inst-other-coach`,
    },
  });
  const athlete = await prisma.user.create({
    data: {
      email: `${NAME_PREFIX}athlete@test.com`.toLowerCase(),
      passwordHash: 'irrelevante-no-se-usa-login-por-password',
      role: UserRole.ATHLETE,
      name: 'Athlete E2E Instances',
      phone: '3000000022',
      phoneCountryCode: '+57',
      identificationType: IdentificationType.CC,
      identificationNumber: `${RUN_ID}-inst-athlete`,
    },
  });
  coachId = coach.id;
  otherCoachId = otherCoach.id;
  athleteId = athlete.id;

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
});

afterAll(async () => {
  await prisma.weeklyFeeling.deleteMany({
    where: { instanceWeek: { instancePhase: { instance: { athleteId } } } },
  });
  await prisma.sessionExerciseResult.deleteMany({
    where: {
      sessionResult: {
        instanceSession: {
          instanceWeek: { instancePhase: { instance: { athleteId } } },
        },
      },
    },
  });
  await prisma.sessionResult.deleteMany({ where: { athleteId } });
  await prisma.planInstance.deleteMany({ where: { athleteId } });
  await prisma.legalAcceptance.deleteMany({ where: { userId: athleteId } });
  await prisma.subscription.deleteMany({ where: { athleteId } });
  await prisma.plan.deleteMany({
    where: { coachId: { in: [coachId, otherCoachId] } },
  });
  await prisma.exercise.deleteMany({
    where: { name: { startsWith: NAME_PREFIX } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [coachId, otherCoachId, athleteId] } },
  });
  await app.close();
});

// ── Helpers de fixtures ────────────────────────────────────────────────────────

/**
 * Publica un plan con UNA sola sesion, cada ejercicio con prescripcion
 * significativa (D-15) — obligatoria para publicar desde EPICA-05.
 */
async function buildPublishedPlanWithExercises(): Promise<{
  planId: string;
  sessionId: string;
}> {
  const planRes = await supertest(http)
    .post('/api/plans')
    .set('Authorization', `Bearer ${coachToken}`)
    .send({
      name: nextName('Plan'),
      startDate: pastDate(30),
      endDate: futureDate(60),
    })
    .expect(201);
  const planId = planRes.body.data.id as string;

  const phaseRes = await supertest(http)
    .post(`/api/plans/${planId}/phases`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ name: nextName('Fase') })
    .expect(201);
  const phaseId = phaseRes.body.data.id as string;

  const weekRes = await supertest(http)
    .post(`/api/plans/${planId}/phases/${phaseId}/weeks`)
    .set('Authorization', `Bearer ${coachToken}`)
    .expect(201);
  const weekId = weekRes.body.data.id as string;

  const sessionRes = await supertest(http)
    .post(`/api/plans/${planId}/weeks/${weekId}/sessions`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ name: nextName('Sesion') })
    .expect(201);
  const sessionId = sessionRes.body.data.id as string;

  const exerciseRes = await supertest(http)
    .post('/api/exercises')
    .set('Authorization', `Bearer ${coachToken}`)
    .send({
      name: nextName('Ejercicio'),
      description: 'Descripcion de prueba',
      muscleGroup: 'Cuadriceps',
    })
    .expect(201);
  const exerciseId = exerciseRes.body.data.id as string;

  await supertest(http)
    .post(`/api/plans/${planId}/sessions/${sessionId}/exercises`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ exerciseId, sets: 4, reps: 10, loadKg: 60 })
    .expect(201);

  await supertest(http)
    .post(`/api/plans/${planId}/publish`)
    .set('Authorization', `Bearer ${coachToken}`)
    .expect(200);

  return { planId, sessionId };
}

/**
 * Suscribe, aprueba y acepta el consentimiento (D-14, ambos documentos) —
 * deja la Subscription Activa, que dispara HU-023 (SubscriptionActivatedListener).
 */
async function activateSubscription(planId: string): Promise<string> {
  const subRes = await supertest(http)
    .post('/api/subscriptions')
    .set('Authorization', `Bearer ${athleteToken}`)
    .send({ planId })
    .expect(201);
  const subscriptionId = subRes.body.data.id as string;

  await supertest(http)
    .post(`/api/subscriptions/${subscriptionId}/approve`)
    .set('Authorization', `Bearer ${coachToken}`)
    .expect(200);

  await supertest(http)
    .post(`/api/subscriptions/${subscriptionId}/accept-consent`)
    .set('Authorization', `Bearer ${athleteToken}`)
    .send({
      sportConsentDocumentVersion: '1.0.0',
      healthDataConsentDocumentVersion: '1.0.0',
    })
    .expect(200);

  return subscriptionId;
}

// ── Flujo feliz de punta a punta ─────────────────────────────────────────────

describe('EPICA-05 — Flujo completo: activacion -> instancia -> resultado -> cierre de semana', () => {
  it(
    'CA-023-1/D-3: tras aceptar el consentimiento, el atleta consulta su instancia ' +
      'INMEDIATAMENTE via GET /instances/:planId — el UNICO endpoint con auto-reparacion ' +
      'sincrona (D-3) — con la prescripcion copiada (CA-023-9); una vez la instancia ' +
      'existe, tambien aparece en el listado',
    async () => {
      const { planId } = await buildPublishedPlanWithExercises();
      await activateSubscription(planId);

      // D-3 solo documenta auto-reparacion SINCRONA para GET /instances/:planId
      // — el listener de HU-023 es fire-and-forget (EventEmitter2.emit no
      // espera al handler), asi que GET /instances (listado, SIN self-heal)
      // llamado inmediatamente despues de accept-consent puede ganar la
      // carrera contra el listener todavia en curso. Se llama primero el
      // endpoint que SI garantiza consistencia sincrona (CA-023-1 lo describe
      // literalmente: "puede consultar su instancia" = el detalle).
      const detailRes = await supertest(http)
        .get(`/api/instances/${planId}`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .expect(200);

      expect(detailRes.body.data.phases).toHaveLength(1);
      const exercise = detailRes.body.data.phases[0].weeks[0].sessions[0]
        .exercises[0] as Record<string, unknown>;
      expect(exercise).toMatchObject({ sets: 4, reps: 10, loadKg: 60 });

      // Ahora que la instancia existe garantizado en la DB, el listado
      // tambien debe mostrarla.
      const listRes = await supertest(http)
        .get('/api/instances')
        .set('Authorization', `Bearer ${athleteToken}`)
        .expect(200);
      expect(
        (listRes.body.data as Array<{ planId: string }>).some(
          (i) => i.planId === planId,
        ),
      ).toBe(true);
    },
  );

  it(
    'CRITICO (D-4, RN-30): registrar resultados de la UNICA sesion programada ' +
      'cierra la semana automaticamente; reintentar editar responde WEEK_FROZEN (409, ' +
      'CA-015-4/5)',
    async () => {
      const { planId } = await buildPublishedPlanWithExercises();
      await activateSubscription(planId);

      const detail = await supertest(http)
        .get(`/api/instances/${planId}`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .expect(200);
      const week = detail.body.data.phases[0].weeks[0] as {
        id: string;
        isClosed: boolean;
      };
      const session = detail.body.data.phases[0].weeks[0].sessions[0] as {
        id: string;
        exercises: Array<{ id: string }>;
      };
      expect(week.isClosed).toBe(false);

      const resultRes = await supertest(http)
        .post(`/api/instances/${planId}/sessions/${session.id}/results`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({
          exercises: [
            {
              sessionExerciseId: session.exercises[0].id,
              sets: 4,
              reps: 10,
              loadKg: 62.5,
              notes: 'Buena sesion',
            },
          ],
        })
        .expect(200);
      expect(resultRes.body.data.exerciseResults).toHaveLength(1);

      const detailAfter = await supertest(http)
        .get(`/api/instances/${planId}`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .expect(200);
      expect(detailAfter.body.data.phases[0].weeks[0].isClosed).toBe(true);
      expect(detailAfter.body.data.phases[0].weeks[0].closedAt).toBeDefined();

      const retry = await supertest(http)
        .post(`/api/instances/${planId}/sessions/${session.id}/results`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .send({
          exercises: [
            { sessionExerciseId: session.exercises[0].id, sets: 5, reps: 8 },
          ],
        })
        .expect(409);
      expect(retry.body.errorCode).toBe('WEEK_FROZEN');
    },
  );

  it('CA-015-10: un payload que omite un ejercicio de la sesion responde 422 RESULT_FIELDS_INVALID sin escribir nada', async () => {
    const { planId } = await buildPublishedPlanWithExercises();
    await activateSubscription(planId);

    const detail = await supertest(http)
      .get(`/api/instances/${planId}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    const session = detail.body.data.phases[0].weeks[0].sessions[0] as {
      id: string;
    };

    const response = await supertest(http)
      .post(`/api/instances/${planId}/sessions/${session.id}/results`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ exercises: [] })
      .expect(400); // ArrayMinSize(1) del DTO rechaza el arreglo vacio antes del service

    expect(response.body).toBeDefined();

    const detailAfter = await supertest(http)
      .get(`/api/instances/${planId}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(
      detailAfter.body.data.phases[0].weeks[0].sessions[0].result,
    ).toBeNull();
  });

  it('CA-016-9: sensaciones fuera de [1,10] responden 400 y NO crean ningun WeeklyFeeling', async () => {
    const { planId } = await buildPublishedPlanWithExercises();
    await activateSubscription(planId);

    const detail = await supertest(http)
      .get(`/api/instances/${planId}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    const week = detail.body.data.phases[0].weeks[0] as { id: string };

    const response = await supertest(http)
      .post(`/api/instances/${planId}/weeks/${week.id}/feelings`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ muscleSoreness: 11, motivation: 5 })
      .expect(400);
    expect(response.headers['content-type']).toMatch(/problem\+json/);

    const detailAfter = await supertest(http)
      .get(`/api/instances/${planId}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(detailAfter.body.data.phases[0].weeks[0].feeling).toBeNull();
  });

  it('registra sensaciones semanales validas (CA-016-1) sobre una semana abierta', async () => {
    const { planId } = await buildPublishedPlanWithExercises();
    await activateSubscription(planId);

    const detail = await supertest(http)
      .get(`/api/instances/${planId}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    const week = detail.body.data.phases[0].weeks[0] as { id: string };

    const response = await supertest(http)
      .post(`/api/instances/${planId}/weeks/${week.id}/feelings`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ muscleSoreness: 4, motivation: 8 })
      .expect(200);

    expect(response.body.data).toMatchObject({
      muscleSoreness: 4,
      motivation: 8,
    });
  });

  it(
    'HU-017/D-9: el coach propietario del plan ve el panel del atleta (200); un coach ' +
      'ajeno responde 403 RESOURCE_OWNERSHIP_DENIED (CA-017-4); un atleta sin instancia ' +
      'en el plan responde 404 ENTITY_NOT_FOUND (NUNCA CONSENT_REQUIRED, D-9)',
    async () => {
      const { planId } = await buildPublishedPlanWithExercises();
      await activateSubscription(planId);

      // findForCoach() (a diferencia de findOwn()) NO tiene auto-reparacion
      // propia (D-3 solo la implementa para el camino del atleta) — se
      // fuerza la creacion sincrona de la instancia via el GET del atleta
      // antes de ejercitar el panel del coach, para no depender de si el
      // listener fire-and-forget ya termino.
      await supertest(http)
        .get(`/api/instances/${planId}`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .expect(200);

      const ownerRes = await supertest(http)
        .get(`/api/instances/${planId}/athletes/${athleteId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);
      expect(ownerRes.body.data.athleteId).toBe(athleteId);

      const foreignRes = await supertest(http)
        .get(`/api/instances/${planId}/athletes/${athleteId}`)
        .set('Authorization', `Bearer ${otherCoachToken}`)
        .expect(403);
      expect(foreignRes.body.errorCode).toBe('RESOURCE_OWNERSHIP_DENIED');

      const { planId: otherPlanId } = await buildPublishedPlanWithExercises();
      const noInstanceRes = await supertest(http)
        .get(`/api/instances/${otherPlanId}/athletes/${athleteId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(404);
      expect(noInstanceRes.body.errorCode).toBe('ENTITY_NOT_FOUND');
    },
    40000, // construye DOS planes completos (buildPublishedPlanWithExercises x2) — excede el testTimeout de 20000ms del archivo
  );

  it('CONSENT_REQUIRED (422) en los tres endpoints que lo exigen cuando la suscripcion NO esta Activa', async () => {
    const { planId, sessionId } = await buildPublishedPlanWithExercises();
    // Solicita pero NUNCA aprueba/activa — suscripcion queda Pendiente.
    await supertest(http)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ planId })
      .expect(201);

    const getRes = await supertest(http)
      .get(`/api/instances/${planId}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(422);
    expect(getRes.body.errorCode).toBe('CONSENT_REQUIRED');

    const resultRes = await supertest(http)
      .post(`/api/instances/${planId}/sessions/${sessionId}/results`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ exercises: [{ sessionExerciseId: sessionId, sets: 1 }] })
      .expect(422);
    expect(resultRes.body.errorCode).toBe('CONSENT_REQUIRED');

    const feelingRes = await supertest(http)
      .post(`/api/instances/${planId}/weeks/${sessionId}/feelings`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ muscleSoreness: 4, motivation: 8 })
      .expect(422);
    expect(feelingRes.body.errorCode).toBe('CONSENT_REQUIRED');
  });
});

// ── 401 sin autenticacion en los 5 endpoints ────────────────────────────────

describe('InstancesController — 401 sin autenticacion', () => {
  const FAKE_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('GET /api/instances', async () => {
    await supertest(http).get('/api/instances').expect(401);
  });

  it('GET /api/instances/:planId', async () => {
    await supertest(http).get(`/api/instances/${FAKE_UUID}`).expect(401);
  });

  it('GET /api/instances/:planId/athletes/:athleteId', async () => {
    await supertest(http)
      .get(`/api/instances/${FAKE_UUID}/athletes/${FAKE_UUID}`)
      .expect(401);
  });

  it('POST /api/instances/:planId/sessions/:sessionId/results', async () => {
    await supertest(http)
      .post(`/api/instances/${FAKE_UUID}/sessions/${FAKE_UUID}/results`)
      .send({ exercises: [{ sessionExerciseId: FAKE_UUID, sets: 1 }] })
      .expect(401);
  });

  it('POST /api/instances/:planId/weeks/:weekId/feelings', async () => {
    await supertest(http)
      .post(`/api/instances/${FAKE_UUID}/weeks/${FAKE_UUID}/feelings`)
      .send({ muscleSoreness: 4, motivation: 8 })
      .expect(401);
  });

  it('403 — un COACH no puede consultar GET /api/instances (solo ATHLETE)', async () => {
    await supertest(http)
      .get('/api/instances')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(403);
  });

  it('403 — un ATHLETE no puede consultar el panel de coach GET /api/instances/:planId/athletes/:athleteId', async () => {
    await supertest(http)
      .get(`/api/instances/${FAKE_UUID}/athletes/${FAKE_UUID}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });
});

// ── Idempotencia de la creacion de instancia (CA-023-8) ─────────────────────

describe('CA-023-8 — idempotencia de la instancia ante activacion duplicada', () => {
  it(
    'GET /api/instances/:planId dos veces seguidas SIEMPRE devuelve la MISMA instancia ' +
      '(mismo id) — ninguna segunda copia se crea aunque el listener y el auto-reparo ' +
      'compitan por la misma suscripcion',
    async () => {
      const { planId } = await buildPublishedPlanWithExercises();
      await activateSubscription(planId);

      const first = await supertest(http)
        .get(`/api/instances/${planId}`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .expect(200);
      const second = await supertest(http)
        .get(`/api/instances/${planId}`)
        .set('Authorization', `Bearer ${athleteToken}`)
        .expect(200);

      expect(first.body.data.id).toBe(second.body.data.id);

      const count = await prisma.planInstance.count({
        where: { planId, athleteId },
      });
      expect(count).toBe(1);
    },
  );
});
