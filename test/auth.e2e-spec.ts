/**
 * Tests E2E para EPICA-01 — Modulo de autenticacion.
 *
 * PREREQUISITOS:
 * - DATABASE_URL configurado en .env apuntando a una DB de test con el schema migrado
 * - JWT_SECRET configurado en .env
 * - pnpm prisma migrate dev aplicado con los modelos User, CoachRequest, LegalAcceptance, etc.
 *
 * NOTA: Estos tests requieren la DB real. Si DATABASE_URL no esta configurado, los tests
 * fallaran con un error de conexion. Ejecutar con: pnpm run test:e2e
 *
 * AISLAMIENTO: cada corrida genera un RUN_ID y todos los emails e identificaciones de
 * prueba lo llevan como prefijo. El afterAll borra por ese prefijo, asi que dos corridas
 * nunca colisionan y la DB no acumula usuarios de test. El borrado en cascada de User
 * arrastra LegalAcceptance, CoachRequest y RefreshToken (ver schema.prisma).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import { DocumentType } from '../generated/prisma/index.js';
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

// ── Datos de prueba E2E ────────────────────────────────────────────────────────

/**
 * Prefijo unico por corrida. Aisla los datos de esta ejecucion y permite el borrado
 * selectivo en afterAll sin tocar datos ajenos a los tests.
 */
const RUN_ID = Date.now().toString(36);
const EMAIL_PREFIX = `e2e-${RUN_ID}-`;
const ID_PREFIX = `E2E-${RUN_ID}-`;

let sequence = 0;

function nextSuffix(): string {
  sequence += 1;
  return `${sequence}`;
}

/**
 * Los nombres de los campos de aceptacion legal son los del DTO: acceptsTermsOfService
 * y acceptsHabeasData. Con forbidNonWhitelisted activo, cualquier variante (por ejemplo
 * acceptedPersonalDataPolicy) hace que el request completo falle con 400.
 */
function buildAthletePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const suffix = nextSuffix();
  return {
    name: 'Atleta E2E Test',
    email: `${EMAIL_PREFIX}atleta-${suffix}@test.com`,
    password: 'TestPassword123',
    phone: '3107654321',
    phoneCountryCode: '57',
    identificationType: 'CC',
    identificationNumber: `${ID_PREFIX}A${suffix}`,
    dateOfBirth: '1995-06-15',
    acceptsTermsOfService: true,
    termsDocumentVersion: 'v2.0',
    acceptsHabeasData: true,
    personalDataDocumentVersion: 'v1.0',
    ...overrides,
  };
}

function buildCoachPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const suffix = nextSuffix();
  return {
    name: 'Coach E2E Test',
    email: `${EMAIL_PREFIX}coach-${suffix}@test.com`,
    password: 'TestPassword123',
    phone: '3001234567',
    phoneCountryCode: '57',
    identificationType: 'CC',
    identificationNumber: `${ID_PREFIX}C${suffix}`,
    dateOfBirth: '1988-03-20',
    planDescription:
      'Especialista en fuerza con 5 anos de experiencia en powerlifting.',
    acceptsTermsOfService: true,
    termsDocumentVersion: 'v2.0',
    acceptsHabeasData: true,
    personalDataDocumentVersion: 'v1.0',
    ...overrides,
  };
}

// ── Setup de la app ───────────────────────────────────────────────────────────

let app: INestApplication;
let prisma: PrismaService;

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
});

afterAll(async () => {
  // Limpieza por prefijo de corrida. La cascada de User elimina LegalAcceptance,
  // CoachRequest y RefreshToken asociados.
  await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
  });
  await app.close();
});

// ── HU-003: POST /api/auth/register ──────────────────────────────────────────

describe('POST /api/auth/register — HU-003: Registro de atleta', () => {
  it('201 — registra atleta con datos validos y retorna id, email, role, createdAt', async () => {
    const payload = buildAthletePayload();

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.email).toBe(payload.email);
    expect(response.body.data.role).toBe('ATHLETE');
    expect(response.body.data.createdAt).toBeDefined();
  });

  it('no expone passwordHash en la respuesta de registro', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload())
      .expect(201);

    expect(response.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('400 — falla cuando falta el campo email', async () => {
    const { email, ...payloadSinEmail } = buildAthletePayload();
    void email;

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payloadSinEmail)
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBeDefined();
  });

  it('400 — falla cuando la password tiene menos de 8 caracteres', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload({ password: 'corta1' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando se envia un campo desconocido (forbidNonWhitelisted)', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload({ campoInventado: 'valor' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando acceptsHabeasData es false (Ley 1581/2012 art. 9)', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload({ acceptsHabeasData: false }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando acceptsTermsOfService es false (Ley 527/1999)', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload({ acceptsTermsOfService: false }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando dateOfBirth corresponde a un menor de edad', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload({ dateOfBirth: '2015-01-01' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando dateOfBirth esta en el futuro', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload({ dateOfBirth: '2099-11-22' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando dateOfBirth supera los 120 anos', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(buildAthletePayload({ dateOfBirth: '1800-01-01' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando dateOfBirth esta ausente (campo obligatorio)', async () => {
    const { dateOfBirth, ...payloadSinFecha } = buildAthletePayload();
    void dateOfBirth;

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payloadSinFecha)
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('409 — retorna DUPLICATE_ENTITY con mensaje neutro ante email duplicado', async () => {
    const payload = buildAthletePayload();

    await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    // Mismo email e identificacion: el unique constraint debe disparar el 409
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(409);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('DUPLICATE_ENTITY');
    // Mensaje neutro — no revela si el conflicto es de email o de identificationNumber
    expect(response.body.detail).toBe(
      'Estos datos ya estan registrados en la plataforma.',
    );
  });

  it('registra exactamente HABEAS_DATA y TERMS_OF_SERVICE — nunca HEALTH_DATA_CONSENT', async () => {
    const payload = buildAthletePayload();

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    // Verificacion directa en BD: el criterio de HU-003 es sobre que se persiste,
    // no sobre el status code. HEALTH_DATA_CONSENT se difiere a EPICA-04 (HU-014).
    const acceptances = await prisma.legalAcceptance.findMany({
      where: { userId: response.body.data.id as string },
      select: { documentType: true, documentVersion: true },
    });

    const tipos = acceptances.map((a) => a.documentType).sort();
    expect(tipos).toEqual([
      DocumentType.HABEAS_DATA,
      DocumentType.TERMS_OF_SERVICE,
    ]);
    expect(tipos).not.toContain(DocumentType.HEALTH_DATA_CONSENT);

    // Las versiones aceptadas quedan trazadas (Ley 527/1999)
    const habeas = acceptances.find(
      (a) => a.documentType === DocumentType.HABEAS_DATA,
    );
    const terminos = acceptances.find(
      (a) => a.documentType === DocumentType.TERMS_OF_SERVICE,
    );
    expect(habeas?.documentVersion).toBe(payload.personalDataDocumentVersion);
    expect(terminos?.documentVersion).toBe(payload.termsDocumentVersion);
  });
});

// ── HU-001: POST /api/auth/coaches/register ───────────────────────────────────

describe('POST /api/auth/coaches/register — HU-001: Registro de coach', () => {
  it('201 — registra solicitud de coach con datos validos y status PENDING', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(buildCoachPayload())
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
    expect(response.body.data.status).toBe('PENDING');
    expect(response.body.data.message).toContain('administrador');
  });

  it('400 — falla cuando falta planDescription', async () => {
    const { planDescription, ...payloadSinPlan } = buildCoachPayload();
    void planDescription;

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(payloadSinPlan)
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando acceptsHabeasData es false (Ley 1581/2012 art. 9)', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(buildCoachPayload({ acceptsHabeasData: false }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — falla cuando el entrenador es menor de edad', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(buildCoachPayload({ dateOfBirth: '2015-01-01' }))
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('persiste dateOfBirth del entrenador — el admin la necesita para revisar la solicitud', async () => {
    const payload = buildCoachPayload({ dateOfBirth: '1988-03-20' });

    await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(payload)
      .expect(201);

    const user = await prisma.user.findUnique({
      where: { email: (payload.email as string).toLowerCase() },
      select: { dateOfBirth: true },
    });

    expect(user?.dateOfBirth).not.toBeNull();
    expect(user?.dateOfBirth?.toISOString().split('T')[0]).toBe('1988-03-20');
  });

  it('409 — retorna DUPLICATE_ENTITY con mensaje neutro ante email duplicado', async () => {
    const payload = buildCoachPayload();

    await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(payload)
      .expect(201);

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(payload)
      .expect(409);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('DUPLICATE_ENTITY');
    expect(response.body.detail).toBe(
      'Estos datos ya estan registrados en la plataforma.',
    );
  });
});

// ── HU-004: POST /api/auth/login ──────────────────────────────────────────────

describe('POST /api/auth/login — HU-004: Inicio de sesion', () => {
  // Atleta dedicado al login: no lo comparten los tests de registro, asi que su
  // contador de intentos fallidos solo lo mueven los tests de este describe.
  const loginPassword = 'LoginTest2026';
  let registeredAthleteEmail: string;

  beforeAll(async () => {
    const payload = buildAthletePayload({ password: loginPassword });
    registeredAthleteEmail = payload.email as string;

    await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);
  });

  it('200 — retorna accessToken, refreshToken, expiresIn y user al autenticar con credenciales correctas', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: registeredAthleteEmail, password: loginPassword })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toMatch(/^rt_/);
    expect(response.body.data.expiresIn).toBe(3600);
    expect(response.body.data.user.email).toBe(registeredAthleteEmail);
    expect(response.body.data.user.role).toBe('ATHLETE');
  });

  it('401 — retorna INVALID_CREDENTIALS con credenciales incorrectas', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: registeredAthleteEmail, password: 'ContrasenaMal123' })
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('401 — el mensaje de error es identico para email inexistente y password incorrecto (anti-enumeracion)', async () => {
    // Error con email inexistente
    const r1 = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: `${EMAIL_PREFIX}noexiste@test.com`,
        password: 'cualquier123',
      });

    // Error con password incorrecta sobre un usuario que si existe
    const r2 = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: registeredAthleteEmail, password: 'MalaClave123' });

    // Ambos deben tener el mismo status y el mismo mensaje
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(r1.body.detail).toBe(r2.body.detail);
    expect(r1.body.errorCode).toBe(r2.body.errorCode);
  });

  it('403 — coach con solicitud PENDING no puede iniciar sesion (COACH_NOT_APPROVED)', async () => {
    const coachPassword = 'CoachPassword123';
    const payload = buildCoachPayload({ password: coachPassword });

    await supertest(app.getHttpServer())
      .post('/api/auth/coaches/register')
      .send(payload)
      .expect(201);

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password: coachPassword })
      .expect(403);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('COACH_NOT_APPROVED');
  });

  it('429 — ACCOUNT_TEMPORARILY_LOCKED despues de 5 intentos fallidos consecutivos', async () => {
    const payload = buildAthletePayload({ password: 'CorrectPass123' });

    await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    // El quinto fallo activa el bloqueo pero sigue respondiendo 401 (INVALID_CREDENTIALS):
    // el bloqueo se evalua al inicio del siguiente intento.
    for (let i = 0; i < 5; i++) {
      await supertest(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: payload.email, password: 'WrongPass123' })
        .expect(401);
    }

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password: 'WrongPass123' })
      .expect(429);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('ACCOUNT_TEMPORARILY_LOCKED');
  });

  it('429 — la cuenta bloqueada rechaza incluso la password correcta', async () => {
    const correctPassword = 'CorrectPass123';
    const payload = buildAthletePayload({ password: correctPassword });

    await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    for (let i = 0; i < 5; i++) {
      await supertest(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: payload.email, password: 'WrongPass123' });
    }

    const response = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password: correctPassword })
      .expect(429);

    expect(response.body.errorCode).toBe('ACCOUNT_TEMPORARILY_LOCKED');
  });

  it('401 — falla cuando falta el campo email', async () => {
    // NOTA: se espera 401 y no 400. En NestJS los guards corren ANTES de los pipes,
    // asi que LocalAuthGuard intercepta el request antes de que el ValidationPipe
    // evalue el LoginDto: Passport no encuentra el campo email y responde 401.
    // El decorador @ApiProblemResponse(400) del endpoint documenta un status que el
    // runtime no puede producir — discrepancia contrato/codigo pendiente de decidir.
    const response = await supertest(app.getHttpServer())
      .post('/api/auth/login')
      .send({ password: 'Password123' })
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('INVALID_CREDENTIALS');
  });
});

// ── HU-002: Endpoints protegidos de /api/coach-requests ───────────────────────

describe('Endpoints /api/coach-requests — HU-002: Endpoints protegidos por JwtAuthGuard + RolesGuard(ADMIN)', () => {
  it('401 — POST /api/coach-requests/search sin token retorna INVALID_CREDENTIALS', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/coach-requests/search')
      .send({})
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('401 — GET /api/coach-requests/:id sin token retorna INVALID_CREDENTIALS', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/coach-requests/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('401 — POST /api/coach-requests/:id/approve sin token retorna INVALID_CREDENTIALS', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/coach-requests/a1b2c3d4-e5f6-7890-abcd-ef1234567890/approve')
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('401 — POST /api/coach-requests/:id/reject sin token retorna INVALID_CREDENTIALS', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/coach-requests/a1b2c3d4-e5f6-7890-abcd-ef1234567890/reject')
      .send({ reason: 'Motivo de prueba para el test.' })
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('401 — un token invalido no llega al ParseUUIDPipe: el JwtAuthGuard actua primero', async () => {
    const response = await supertest(app.getHttpServer())
      .get('/api/coach-requests/not-a-valid-uuid')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });
});

// ── EPICA-09: Endpoints protegidos de /api/admin-invitations ──────────────────

describe('Endpoints /api/admin-invitations — EPICA-09', () => {
  it('401 — POST /api/admin-invitations sin token retorna error de autenticacion', async () => {
    const response = await supertest(app.getHttpServer())
      .post('/api/admin-invitations')
      .send({ email: `${EMAIL_PREFIX}invitado@test.com` })
      .expect(401);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('400 — POST /api/admin-invitations/verify con token de formato invalido', async () => {
    // El DTO exige exactamente 64 caracteres (hex de sha256).
    const response = await supertest(app.getHttpServer())
      .post('/api/admin-invitations/verify')
      .send({ token: 'token-corto' })
      .expect(400);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
  });

  it('404 — POST /api/admin-invitations/verify con token bien formado pero inexistente', async () => {
    // Endpoint publico: el token viaja en el body, nunca en la URL (Ley 1273/2009).
    const response = await supertest(app.getHttpServer())
      .post('/api/admin-invitations/verify')
      .send({ token: 'f'.repeat(64) })
      .expect(404);

    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body.errorCode).toBe('ENTITY_NOT_FOUND');
    // El detalle no debe reflejar el token enviado
    expect(JSON.stringify(response.body)).not.toContain('f'.repeat(64));
  });
});
