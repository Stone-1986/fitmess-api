/**
 * Tests e2e del rastro de auditoria (hallazgo abierto #1).
 *
 * El valor de estos tests esta en que escriben y leen la tabla real. Los
 * unitarios de AuditMiddleware usan Prisma mockeado, asi que prueban la forma
 * de la fila pero no que llegue a `audit_logs` — que era justamente el
 * problema: el modelo existia desde EPICA-01 y nadie escribia en el.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/modules/prisma/prisma.service.js';
import { ResponseInterceptor } from '../src/modules/common/interceptors/response.interceptor.js';
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
    return Object.values(error.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
  });
}

let app: INestApplication;
let prisma: PrismaService;

/** Marca cada corrida para poder limpiar solo sus filas. */
const RUN_ID = Date.now().toString(36);
const AGENT = `audit-e2e-${RUN_ID}`;

/**
 * La escritura de auditoria es fire-and-forget despues de `finish`, asi que la
 * respuesta puede llegar antes que la fila. Se sondea en vez de asumir.
 */
async function esperarFila(
  where: Record<string, unknown>,
  intentos = 20,
): Promise<Record<string, unknown> | null> {
  for (let i = 0; i < intentos; i++) {
    const fila = await prisma.auditLog.findFirst({
      where: { userAgent: AGENT, ...where },
      orderBy: { createdAt: 'desc' },
    });
    if (fila) return fila as unknown as Record<string, unknown>;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

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
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(flattenValidationErrors(errors)),
    }),
  );
  app.setGlobalPrefix('api');
  await app.init();

  prisma = app.get(PrismaService, { strict: false });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userAgent: AGENT } });
  await app.close();
});

describe('Rastro de auditoria — AuditMiddleware', () => {
  it('registra una fila en audit_logs por cada request', async () => {
    await supertest(app.getHttpServer())
      .get('/api/exercises')
      .set('User-Agent', AGENT)
      .expect(401);

    const fila = await esperarFila({ url: '/api/exercises' });

    expect(fila).not.toBeNull();
    expect(fila?.method).toBe('GET');
    expect(fila?.statusCode).toBe(401);
    expect(typeof fila?.duration).toBe('number');
  });

  it('registra los rechazos de los guards — lo que un interceptor no podria ver', async () => {
    await supertest(app.getHttpServer())
      .post('/api/exercises')
      .set('User-Agent', AGENT)
      .send({ name: 'x', description: 'y', muscleGroup: 'z' })
      .expect(401);

    const fila = await esperarFila({ method: 'POST', statusCode: 401 });

    expect(fila).not.toBeNull();
    // El guard rechaza ANTES de que corra cualquier interceptor: si la
    // auditoria viviera en un interceptor, este intento no dejaria rastro.
    expect(fila?.url).toBe('/api/exercises');
  });

  it('guarda el errorCode del catalogo, no solo el status HTTP', async () => {
    await supertest(app.getHttpServer())
      .get('/api/exercises')
      .set('User-Agent', AGENT)
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    const fila = await esperarFila({ statusCode: 401 });

    expect(fila).not.toBeNull();
    // Un 401 puede venir de varias causas; el codigo del catalogo las distingue.
    expect(fila?.error).toBeTruthy();
  });

  it('propaga el correlationId del request a la fila de auditoria', async () => {
    const correlationId = `corr-${RUN_ID}`;

    await supertest(app.getHttpServer())
      .get('/api/exercises')
      .set('User-Agent', AGENT)
      .set('x-correlation-id', correlationId)
      .expect(401);

    const fila = await esperarFila({ correlationId });

    expect(fila).not.toBeNull();
    expect(fila?.correlationId).toBe(correlationId);
  });

  it('NUNCA guarda el query string', async () => {
    await supertest(app.getHttpServer())
      .get('/api/exercises?page=2&limit=5')
      .set('User-Agent', AGENT)
      .expect(401);

    const fila = await esperarFila({ url: '/api/exercises' });

    expect(fila).not.toBeNull();
    expect(fila?.url).toBe('/api/exercises');
    expect(JSON.stringify(fila)).not.toContain('page=2');
  });

  it('NO audita el health check', async () => {
    await supertest(app.getHttpServer())
      .get('/api/health')
      .set('User-Agent', AGENT)
      .expect(200);

    // Se espera activamente antes de afirmar la ausencia: si se consultara de
    // inmediato, el test pasaria aunque el middleware si estuviera auditando.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const fila = await prisma.auditLog.findFirst({
      where: { userAgent: AGENT, url: '/api/health' },
    });

    expect(fila).toBeNull();
  });

  it('NUNCA guarda el body del request', async () => {
    const documento = `DOC-SECRETO-${RUN_ID}`;

    await supertest(app.getHttpServer())
      .post('/api/coach-requests/search')
      .set('User-Agent', AGENT)
      .send({ identificationNumber: documento })
      .expect(401);

    const fila = await esperarFila({ url: '/api/coach-requests/search' });

    expect(fila).not.toBeNull();
    expect(JSON.stringify(fila)).not.toContain(documento);
  });
});
