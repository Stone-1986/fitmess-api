import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';

/**
 * JwtAuthGuard — protege endpoints que requieren autenticacion JWT.
 *
 * Usa la JwtStrategy de Passport para validar el token Bearer.
 * Lanza BusinessException con INVALID_CREDENTIALS si el token es invalido o ausente.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw new BusinessException(
        BusinessError.INVALID_CREDENTIALS,
        'Token de autenticacion invalido o ausente',
      );
    }
    return user;
  }
}
