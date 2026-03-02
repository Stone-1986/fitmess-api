import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../strategies/jwt.strategy.js';

/**
 * @CurrentUser() — extrae el usuario autenticado del request.
 *
 * Requiere JwtAuthGuard activo. Retorna el objeto AuthUser
 * que populó la JwtStrategy: { id, email, role }.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
