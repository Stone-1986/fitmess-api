import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { CommonModule } from './modules/common/common.module.js';
import { AuditMiddleware } from './modules/common/middlewares/audit.middleware.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ExercisesModule } from './modules/exercises/exercises.module.js';
import { PlansModule } from './modules/plans/plans.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { CorrelationIdMiddleware } from './modules/common/middlewares/correlation-id.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        autoLogging: true,
        quietReqLogger: true,
      },
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    ExercisesModule,
    PlansModule,
    SubscriptionsModule,
    NotificationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // El orden importa: CorrelationIdMiddleware debe correr primero para que
    // AuditMiddleware pueda leer `request.correlationId` al cerrar la respuesta
    // y así ligar la fila de auditoría con las líneas del log de la aplicación.
    consumer
      .apply(CorrelationIdMiddleware, AuditMiddleware)
      .forRoutes('{*path}');
  }
}
