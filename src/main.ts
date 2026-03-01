import * as Sentry from '@sentry/nestjs';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ResponseInterceptor } from './modules/common/interceptors/response.interceptor.js';
import { ProblemDetailFilter } from './modules/common/filters/problem-detail.filter.js';
import { PrismaExceptionFilter } from './modules/common/filters/prisma-exception.filter.js';
import { ValidationExceptionFilter } from './modules/common/filters/validation-exception.filter.js';
import { GlobalExceptionFilter } from './modules/common/filters/global-exception.filter.js';

/**
 * Aplana recursivamente los ValidationError de class-validator.
 *
 * class-validator puede retornar errores anidados (ej: objetos con @ValidateNested).
 * Esta función los convierte en un array plano con paths como "address.street".
 */
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

async function bootstrap() {
  // Sentry — solo si SENTRY_DSN tiene valor
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn });
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logger (pino via nestjs-pino)
  app.useLogger(app.get(Logger));

  // Seguridad HTTP
  app.use(helmet());

  // CORS — habilitado para desarrollo
  app.enableCors();

  // Prefijo global
  app.setGlobalPrefix('api');

  // Swagger — solo en ambientes no productivos
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('fitmess API')
      .setDescription('API de la plataforma de fitness fitmess')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Validation — exceptionFactory inyecta `isValidation: true` para que
  // ValidationExceptionFilter los identifique sin depender de Array.isArray(message)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const validationErrors = flattenValidationErrors(errors);
        return new BadRequestException({
          isValidation: true,
          errors: validationErrors,
        });
      },
    }),
  );

  // Interceptors
  app.useGlobalInterceptors(
    new ResponseInterceptor(), // Envelope de éxito { success, data, meta, timestamp }
  );

  // Exception Filters
  // IMPORTANTE: NestJS aplica los filters en orden LIFO.
  // El último registrado en el array tiene MAYOR prioridad (se evalúa primero).
  // Por eso GlobalExceptionFilter va primero (menor prioridad, catch-all de último recurso)
  // y ProblemDetailFilter va último (mayor prioridad, captura Business/Technical primero).
  const { httpAdapter } = app.get(HttpAdapterHost);
  const filters = [
    ...(sentryDsn ? [new SentryGlobalFilter(httpAdapter)] : []),
    new GlobalExceptionFilter(), // prioridad 1 — catch-all (ejecuta si los demás no capturan)
    new PrismaExceptionFilter(), // prioridad 2 — errores de Prisma
    new ValidationExceptionFilter(), // prioridad 3 — errores de validación (BadRequestException)
    new ProblemDetailFilter(), // prioridad 4 — Business + Technical exceptions (mayor prioridad)
  ];
  app.useGlobalFilters(...filters);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
