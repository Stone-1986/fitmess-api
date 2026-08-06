import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../../generated/prisma/index.js';

export const ROLES_KEY = 'roles';

/**
 * Decorador @Roles — define los roles requeridos para acceder a un endpoint.
 *
 * Uso:
 * @Roles(UserRole.ADMIN)
 * async miEndpoint() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
