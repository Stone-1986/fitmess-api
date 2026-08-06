/**
 * Tests E2E para EPICA-02 — Modulo de ejercicios.
 *
 * PREREQUISITOS:
 * - DATABASE_URL configurado en .env apuntando a una DB de test con el schema migrado
 * - pnpm prisma migrate dev aplicado con los modelos Exercise y ExerciseVersion, incluyendo
 *   el indice unico PARCIAL sobre lower(name) WHERE is_active = true (a cargo del DBA)
 *
 * NOTA: Estos tests requieren la DB real. Ejecutar con: pnpm run test:e2e
 *
 * Alcance de este archivo (ver plan_de_implementacion.yaml, orden_de_implementacion paso 7):
 *
 * (1) Los dos tests originales blindan el COMPORTAMIENTO del indice unico parcial de
 *     Postgres, no la implementacion del service. Escriben directo a la tabla `exercises`
 *     con el cliente de Prisma, sin pasar por ExercisesService ni por HTTP — saltan
 *     deliberadamente el pre-check de aplicacion para verificar que la garantia real vive
 *     en la base de datos, no solo en el codigo. Si el indice parcial desaparece en un
 *     futuro `prisma migrate dev` o se reemplaza por error por un UNIQUE simple, alguno
 *     de los dos tests de esta seccion falla (hallazgo abierto #7 de
 *     outputs/execution-log.md).
 *
 * (2) Los tests HTTP ejercitan los 5 endpoints (POST/GET/GET:id/PATCH/DELETE /api/exercises)
 *     a traves del pipeline completo: ValidationPipe sobre los DTOs, JwtAuthGuard +
 *     RolesGuard(COACH, ADMIN), exception filters (problem+json) y el ResponseInterceptor
 *     (envelope { success, statusCode, data, meta?, message?, timestamp }). Los tests
 *     unitarios de exercises.service.spec.ts y exercises.controller.spec.ts no pueden ver
 *     nada de esto porque llaman al service/controller directamente sin pasar por HTTP.
 *
 * AUTENTICACION: JwtAuthGuard y RolesGuard resuelven el usuario UNICAMENTE a partir del
 * payload del JWT (sub, email, role) — no consultan la base de datos (ver
 * JwtStrategy.validate()). Por eso estos tests firman tokens directamente con JwtService
 * usando el mismo JWT_SECRET que la app, sin necesidad de crear un User real en la DB
 * para cada rol. Esto es valido para ejercitar guards/DTOs/envelope; no sustituye la
 * cobertura de autenticacion real que ya cubre test/auth.e2e-spec.ts.
 *
 * AISLAMIENTO: cada corrida genera un RUN_ID y todos los `name` de prueba lo llevan como
 * prefijo. El afterAll borra por ese prefijo, asi que dos corridas nunca colisionan.
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
import { UserRole } from '../generated/prisma/index.js';
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

const RUN_ID = Date.now().toString(36);
const NAME_PREFIX = `E2E-${RUN_ID}-`;

let sequence = 0;
function nextName(base: string): string {
  sequence += 1;
  return `${NAME_PREFIX}${base}-${sequence}`;
}

function buildCreatePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: nextName('Ejercicio'),
    description: 'Descripcion de prueba para el ejercicio E2E.',
    muscleGroup: 'Cuadriceps',
    ...overrides,
  };
}

// ── Setup de la app ───────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;
let jwtService: JwtService;

let coachToken: string;
let adminToken: string;
let athleteToken: string;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  // Replicar exactamente el setup de main.ts
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
        const exception = new BadRequestException(flatErrors);
        return exception;
      },
    }),
  );
  app.setGlobalPrefix('api');

  await app.init();

  prisma = app.get(PrismaService, { strict: false });

  // JwtAuthGuard/RolesGuard solo resuelven el usuario desde el payload del
  // token (sub, email, role) — no consultan la DB (ver JwtStrategy.validate()).
  // Firmar tokens directamente con el mismo JWT_SECRET de la app es suficiente
  // para ejercitar guards, DTOs y el envelope de respuesta.
  const configService = app.get(ConfigService, { strict: false });
  jwtService = new JwtService({
    secret: configService.getOrThrow<string>('JWT_SECRET'),
  });

  coachToken = jwtService.sign({
    sub: `${NAME_PREFIX}coach-id`,
    email: 'coach-e2e@test.com',
    role: UserRole.COACH,
  });
  adminToken = jwtService.sign({
    sub: `${NAME_PREFIX}admin-id`,
    email: 'admin-e2e@test.com',
    role: UserRole.ADMIN,
  });
  athleteToken = jwtService.sign({
    sub: `${NAME_PREFIX}athlete-id`,
    email: 'athlete-e2e@test.com',
    role: UserRole.ATHLETE,
  });
});

afterAll(async () => {
  await prisma.exercise.deleteMany({
    where: { name: { startsWith: NAME_PREFIX } },
  });
  await app.close();
});

// ── Indice unico parcial sobre exercises(lower(name)) WHERE is_active ─────────

describe('Indice unico parcial de exercises — CA-005-2 / CA-005-6', () => {
  it('UNICIDAD — rechaza dos ejercicios ACTIVOS cuyos names difieren solo en mayusculas', async () => {
    const baseName = `${NAME_PREFIX}Sentadilla`;

    // Primer INSERT directo a la tabla (sin pasar por ExercisesService): ACTIVO por defecto.
    await prisma.exercise.create({ data: { name: baseName } });

    // Segundo INSERT, mismo name salvo mayusculas, tambien ACTIVO. El pre-check de
    // aplicacion (ExercisesService.ensureNameNotDuplicated) NO corre aqui — la unica
    // garantia posible en este test es el indice unico parcial de Postgres.
    await expect(
      prisma.exercise.create({
        data: { name: baseName.toLowerCase() },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    // Limpieza inmediata (no diferida al afterAll): estos INSERT directos crean
    // un Exercise SIN ExerciseVersion, un estado invalido del dominio que
    // findAll() no espera (ver decisiones_arquitectonicas del plan). Si quedan
    // vivos hasta el afterAll, contaminan cualquier GET /exercises posterior
    // en esta misma corrida.
    await prisma.exercise.deleteMany({ where: { name: baseName } });
  });

  it('PARCIALIDAD — permite un ejercicio ACTIVO con el mismo name de uno INHABILITADO', async () => {
    const baseName = `${NAME_PREFIX}Peso Muerto`;

    // Primer INSERT: INHABILITADO desde el inicio (isActive=false).
    await prisma.exercise.create({
      data: { name: baseName, isActive: false },
    });

    // Segundo INSERT: mismo name exacto, ACTIVO. El indice parcial solo cubre
    // is_active = true, asi que este INSERT debe proceder sin error (CA-005-6).
    const second = await prisma.exercise.create({
      data: { name: baseName, isActive: true },
    });

    expect(second.id).toBeDefined();
    expect(second.isActive).toBe(true);

    // Limpieza inmediata — mismo motivo que el test anterior.
    await prisma.exercise.deleteMany({ where: { name: baseName } });
  });
});

// ── POST /api/exercises — HU-005 ───────────────────────────────────────────────

describe('POST /api/exercises — HU-005: Crear ejercicio', () => {
  it('201 — COACH crea un ejercicio y recibe el envelope con Exercise + version 1', async () => {
    const payload = buildCreatePayload();

    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.name).toBe(payload.name);
    expect(response.body.data.description).toBe(payload.description);
    expect(response.body.data.muscleGroup).toBe(payload.muscleGroup);
    expect(response.body.data.versionNumber).toBe(1);
    expect(response.body.data.isActive).toBe(true);
    expect(response.body.data.archivedAt).toBeUndefined();
  });

  it('201 — ADMIN tambien puede crear ejercicios', async () => {
    const payload = buildCreatePayload();

    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    expect(response.body.data.name).toBe(payload.name);
  });

  it('401 — sin token retorna error de autenticacion', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .send(buildCreatePayload())
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('403 — ATHLETE no puede crear ejercicios (RN-22)', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send(buildCreatePayload())
      .expect(403);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla la validacion del ValidationPipe cuando falta name', async () => {
    const { name, ...payloadSinName } = buildCreatePayload();
    void name;

    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(payloadSinName)
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando description esta vacia', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ description: '' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando se envia un campo desconocido (forbidNonWhitelisted)', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ campoInventado: 'valor' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('409 — DUPLICATE_ENTITY si ya existe un ejercicio ACTIVO con el mismo name (CA-005-2, case-insensitive + trim)', async () => {
    const name = nextName('Press Banca');

    await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name }))
      .expect(201);

    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name: `  ${name.toUpperCase()}  ` }))
      .expect(409);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('DUPLICATE_ENTITY');
  });

  it('201 — CA-005-6: el name de un ejercicio INHABILITADO queda libre para uno nuevo', async () => {
    const name = nextName('Remo con barra');

    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name }))
      .expect(201);

    await supertest(app.getHttpServer())
      .delete(`/api/exercises/${created.body.data.id as string}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name }))
      .expect(201);

    expect(response.body.data.name).toBe(name);
    expect(response.body.data.isActive).toBe(true);
  });
});

// ── GET /api/exercises — HU-005 (CA-005-3) + HU-007 (CA-007-2) ────────────────

describe('GET /api/exercises — Listado del catalogo', () => {
  let activeName: string;
  let inactiveName: string;

  beforeAll(async () => {
    activeName = nextName('Zancada');
    inactiveName = nextName('Curl biceps');

    await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name: activeName }))
      .expect(201);

    const inactive = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name: inactiveName }))
      .expect(201);

    await supertest(app.getHttpServer())
      .delete(`/api/exercises/${inactive.body.data.id as string}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
  });

  it('200 — filtra isActive=true por defecto: el inhabilitado no aparece (CA-007-2)', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises?limit=100')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.meta).toBeDefined();
    const names = (response.body.data as Array<{ name: string }>).map(
      (e) => e.name,
    );
    expect(names).toContain(activeName);
    expect(names).not.toContain(inactiveName);
  });

  it('200 — includeInactive=true tambien incluye el inhabilitado', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises?limit=100&includeInactive=true')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const names = (response.body.data as Array<{ name: string }>).map(
      (e) => e.name,
    );
    expect(names).toContain(activeName);
    expect(names).toContain(inactiveName);
  });

  it('401 — sin token retorna error de autenticacion', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises')
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('403 — ATHLETE no puede listar el catalogo (esta epica no lo habilita)', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla la validacion del ValidationPipe con page invalido', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises?page=0')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla la validacion del ValidationPipe con limit fuera de rango', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises?limit=101')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });
});

// ── GET /api/exercises/:id — HU-006 (CA-006-2) + HU-007 (CA-007-3) ────────────

describe('GET /api/exercises/:id — Detalle con historial de versiones', () => {
  it('200 — retorna el detalle con el historial de versiones (CA-006-2)', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const id = created.body.data.id as string;

    const response = await supertest(app.getHttpServer())
      .get(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(id);
    expect(response.body.data.versions).toHaveLength(1);
    expect(response.body.data.versions[0].versionNumber).toBe(1);
    expect(response.body.data.versions[0].createdAt).toBeDefined();
  });

  it('200 — retorna un ejercicio INHABILITADO sin filtrarlo, con isActive=false visible (CA-007-3)', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const id = created.body.data.id as string;

    await supertest(app.getHttpServer())
      .delete(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(app.getHttpServer())
      .get(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.data.isActive).toBe(false);
  });

  it('401 — sin token retorna error de autenticacion', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('403 — ATHLETE no puede consultar el detalle', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('404 — ENTITY_NOT_FOUND si el ejercicio no existe', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('ENTITY_NOT_FOUND');
  });

  it('400 — un id que no es UUID es rechazado por ParseUUIDPipe', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/exercises/not-a-valid-uuid')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });
});

// ── PATCH /api/exercises/:id — HU-006 ──────────────────────────────────────────

describe('PATCH /api/exercises/:id — Modificar ejercicio', () => {
  it('200 — edita description/muscleGroup in-place (CA-006-3, isUsedInPlan() hoy siempre false)', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const id = created.body.data.id as string;

    const response = await supertest(app.getHttpServer())
      .patch(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ description: 'Descripcion actualizada via E2E' })
      .expect(200);

    expect(response.body.data.description).toBe(
      'Descripcion actualizada via E2E',
    );
    // isUsedInPlan() retorna false hoy => edicion in-place, versionNumber no avanza
    expect(response.body.data.versionNumber).toBe(1);
  });

  it('200 — renombra el ejercicio (name vive en Exercise, no versionado)', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const id = created.body.data.id as string;
    const newName = nextName('Renombrado');

    const response = await supertest(app.getHttpServer())
      .patch(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: newName })
      .expect(200);

    expect(response.body.data.name).toBe(newName);
  });

  it('401 — sin token retorna error de autenticacion', async () => {
    const response = await supertest(app.getHttpServer())
      .patch('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .send({ description: 'x' })
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('403 — ATHLETE no puede modificar ejercicios', async () => {
    const response = await supertest(app.getHttpServer())
      .patch('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ description: 'x' })
      .expect(403);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('404 — ENTITY_NOT_FOUND si el ejercicio no existe (CA-006-4)', async () => {
    const response = await supertest(app.getHttpServer())
      .patch('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ description: 'x'.repeat(20) })
      .expect(404);

    expect(response.body.errorCode).toBe('ENTITY_NOT_FOUND');
  });

  it('400 — falla la validacion cuando se envia description vacia', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const response = await supertest(app.getHttpServer())
      .patch(`/api/exercises/${created.body.data.id as string}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ description: '' })
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('409 — DUPLICATE_ENTITY si el nuevo name colisiona con otro ejercicio ACTIVO', async () => {
    const existingName = nextName('Existente');
    await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name: existingName }))
      .expect(201);

    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const response = await supertest(app.getHttpServer())
      .patch(`/api/exercises/${created.body.data.id as string}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: existingName })
      .expect(409);

    expect(response.body.errorCode).toBe('DUPLICATE_ENTITY');
  });

  it('200 — CA-005-6: el rename puede reutilizar el name de un ejercicio INHABILITADO', async () => {
    const freedName = nextName('Sera liberado');

    const toDeactivate = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload({ name: freedName }))
      .expect(201);

    await supertest(app.getHttpServer())
      .delete(`/api/exercises/${toDeactivate.body.data.id as string}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const response = await supertest(app.getHttpServer())
      .patch(`/api/exercises/${created.body.data.id as string}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: freedName })
      .expect(200);

    expect(response.body.data.name).toBe(freedName);
  });

  it('422 — EXERCISE_INACTIVE si el ejercicio ya esta inhabilitado, sin crear version nueva (CA-006-6)', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const id = created.body.data.id as string;

    await supertest(app.getHttpServer())
      .delete(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(app.getHttpServer())
      .patch(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ description: 'No deberia aplicarse' })
      .expect(422);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('EXERCISE_INACTIVE');

    // El rechazo no altero la version vigente
    const detail = await supertest(app.getHttpServer())
      .get(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
    expect(detail.body.data.versions).toHaveLength(1);
    expect(detail.body.data.description).not.toBe('No deberia aplicarse');
  });
});

// ── DELETE /api/exercises/:id — HU-007 ─────────────────────────────────────────

describe('DELETE /api/exercises/:id — Inhabilitar ejercicio', () => {
  it('200 — inhabilita el ejercicio y retorna { data: null, message } (soft-delete via isActive)', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const id = created.body.data.id as string;

    const response = await supertest(app.getHttpServer())
      .delete(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
    expect(response.body.message).toBe('Ejercicio inhabilitado exitosamente');

    const detail = await supertest(app.getHttpServer())
      .get(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);
    expect(detail.body.data.isActive).toBe(false);
  });

  it('401 — sin token retorna error de autenticacion', async () => {
    const response = await supertest(app.getHttpServer())
      .delete('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('403 — ATHLETE no puede inhabilitar ejercicios', async () => {
    const response = await supertest(app.getHttpServer())
      .delete('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('404 — ENTITY_NOT_FOUND si el ejercicio no existe', async () => {
    const response = await supertest(app.getHttpServer())
      .delete('/api/exercises/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(404);

    expect(response.body.errorCode).toBe('ENTITY_NOT_FOUND');
  });

  it('422 — EXERCISE_INACTIVE si el ejercicio ya estaba inhabilitado (CA-007-4), nunca EXERCISE_IN_USE', async () => {
    const created = await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('Authorization', `Bearer ${coachToken}`)
      .send(buildCreatePayload())
      .expect(201);

    const id = created.body.data.id as string;

    await supertest(app.getHttpServer())
      .delete(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(200);

    const response = await supertest(app.getHttpServer())
      .delete(`/api/exercises/${id}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .expect(422);

    expect(response.body.errorCode).toBe('EXERCISE_INACTIVE');
    expect(response.body.errorCode).not.toBe('EXERCISE_IN_USE');
  });
});
