import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';

/**
 * LocalAuthGuard — activa la LocalStrategy de Passport para POST /auth/login.
 *
 * La LocalStrategy llama a AuthService.validateCredentials() que:
 * 1. Verifica bloqueo por cuenta (ACCOUNT_TEMPORARILY_LOCKED)
 * 2. Verifica credenciales (INVALID_CREDENTIALS)
 * 3. Resetea contador de intentos fallidos en login exitoso
 *
 * handleRequest() garantiza que cualquier error (incluso inesperado) se
 * devuelve en formato RFC 9457 consistente, siguiendo el patron de JwtAuthGuard.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      if (err instanceof BusinessException) throw err;
      throw new BusinessException(
        BusinessError.INVALID_CREDENTIALS,
        'Credenciales invalidas. Verifica tu correo electronico y contrasena.',
      );
    }
    return user;
  }
}
