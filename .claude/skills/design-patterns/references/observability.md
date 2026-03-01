# Observabilidad — Implementacion completa

Referencia de implementacion para logging estructurado, correlation ID y niveles de log.

## Tabla de contenido

1. [Configuracion de nestjs-pino](#1-configuracion-de-nestjs-pino)
2. [Correlation ID Middleware](#2-correlation-id-middleware)
3. [Uso en services](#3-uso-en-services)
4. [Niveles de log](#4-niveles-de-log)

---

## 1. Configuracion de nestjs-pino

```typescript
// app.module.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('LOG_LEVEL', 'info'),

          // Produccion: JSON puro. Desarrollo: pino-pretty
          transport: configService.get('NODE_ENV') !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  levelFirst: true,
                  translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,

          // Correlation ID automatico
          genReqId: (request) => {
            return request.headers['x-correlation-id'] ?? randomUUID();
          },

          // Campos sensibles redactados (Ley 1581/2012)
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.token',
              'req.body.refreshToken',
            ],
            censor: '[REDACTED]',
          },

          // No loggear health checks
          autoLogging: {
            ignore: (req) => req.url === '/health',
          },

          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              query: req.query,
              params: req.params,
              // body NO se incluye por defecto (datos sensibles)
            }),
            res: (res) => ({
              statusCode: res.statusCode,
            }),
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

```typescript
// main.ts — Reemplazar logger de NestJS por Pino
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // ...
}
```

---

## 2. Correlation ID Middleware

Cada request recibe un UUID unico que se propaga a todas las capas.

```typescript
// src/modules/common/middleware/correlation-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void): void {
    const correlationId = req.headers['x-correlation-id'] ?? randomUUID();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
```

**Flujo completo:**

```
Cliente → Header x-correlation-id (opcional)
  ↓
CorrelationIdMiddleware → req.correlationId = UUID
  ↓
nestjs-pino → req.id (= correlationId) en cada log
  ↓
AuditInterceptor → correlationId en audit_logs
  ↓
ExceptionFilters → correlationId en respuestas de error
  ↓
Response Header → x-correlation-id: UUID
```

---

## 3. Uso en services

```typescript
// @nestjs/common Logger — se enruta automaticamente a traves de Pino cuando se configura en main.ts
import { Logger, Injectable } from '@nestjs/common';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  async publish(planId: string, coachId: string): Promise<Plan> {
    this.logger.log(`Publicando plan ${planId} por coach ${coachId}`);

    // ... logica de negocio ...

    this.logger.log(`Plan ${planId} publicado exitosamente`);
    return updated;
  }
}
```

---

## 4. Niveles de log

| Nivel | Cuando usarlo | Ejemplo Fitmess |
|-------|--------------|-----------------|
| `fatal` | App no puede continuar | Conexion a PostgreSQL perdida irrecuperablemente |
| `error` | Error que requiere atencion | Claude API timeout, transaccion de deep copy fallo |
| `warn` | Situacion anomala pero manejada | Transicion de estado invalida, ventana de edicion expirada |
| `info` | Operaciones de negocio significativas | Plan publicado, suscripcion aprobada, semana cerrada |
| `debug` | Detalle para desarrollo | Query Prisma ejecutada, payload de evento emitido |
| `trace` | Maximo detalle (solo local) | Contenido completo de DTOs, step-by-step de deep copy |

**Regla:** En produccion, nivel minimo `info`. En desarrollo, `debug`. Nunca `trace` en produccion.
