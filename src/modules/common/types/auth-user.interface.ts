import { UserRole } from '../../../../generated/prisma/index.js';

/**
 * Forma del usuario autenticado que queda en `request.user`.
 *
 * Vive en `common` y no en `auth` a proposito: es el contrato que consumen
 * los guards, los decoradores de parametro y los controllers de cualquier
 * modulo. Si viviera en `auth/shared/strategies/`, `common` tendria que
 * importar de `auth` para tiparlo — la dependencia al reves de como esta
 * pensada la arquitectura. `common` define el contrato; `auth` lo implementa
 * en JwtStrategy.validate().
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
