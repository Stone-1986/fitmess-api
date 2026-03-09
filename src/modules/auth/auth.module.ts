import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthService } from './core/auth.service.js';
import { CoachRequestsService } from './coach-requests/coach-requests.service.js';
import { AdminInvitationsService } from './admin-invitations/admin-invitations.service.js';
import { AuthController } from './core/auth.controller.js';
import { CoachRequestsController } from './coach-requests/coach-requests.controller.js';
import { AdminInvitationsController } from './admin-invitations/admin-invitations.controller.js';
import { LocalStrategy } from './shared/strategies/local.strategy.js';
import { JwtStrategy } from './shared/strategies/jwt.strategy.js';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard.js';
import { LocalAuthGuard } from './shared/guards/local-auth.guard.js';
import { RolesGuard } from './shared/guards/roles.guard.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<StringValue>(
            'JWT_EXPIRES_IN',
            '1h' as StringValue,
          ),
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    CoachRequestsController,
    AdminInvitationsController,
  ],
  providers: [
    AuthService,
    CoachRequestsService,
    AdminInvitationsService,
    LocalStrategy,
    JwtStrategy,
    JwtAuthGuard,
    LocalAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
