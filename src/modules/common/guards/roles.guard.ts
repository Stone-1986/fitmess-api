import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../../generated/prisma/index.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { BusinessException } from '../exceptions/business.exception.js';
import { BusinessError } from '../exceptions/business-error.enum.js';
import type { AuthUser } from '../types/auth-user.interface.js';

/**
 * RolesGuard — verifica que el usuario autenticado tenga el rol requerido.
 *
 * Requiere que JwtAuthGuard se ejecute antes (request.user debe estar poblado).
 * Lanza BusinessException con RESOURCE_OWNERSHIP_DENIED si el rol no coincide.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new BusinessException(
        BusinessError.INVALID_CREDENTIALS,
        'Usuario no autenticado',
      );
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new BusinessException(
        BusinessError.RESOURCE_OWNERSHIP_DENIED,
        `Acceso denegado. Se requiere rol: ${requiredRoles.join(', ')}`,
        { userRole: user.role, requiredRoles },
      );
    }

    return true;
  }
}
