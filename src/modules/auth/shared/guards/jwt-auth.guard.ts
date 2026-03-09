import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { BusinessException } from '../../../common/exceptions/business.exception.js';
import { BusinessError } from '../../../common/exceptions/business-error.enum.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * JwtAuthGuard — protege endpoints que requieren autenticacion JWT.
 *
 * Usa la JwtStrategy de Passport para validar el token Bearer.
 * Lanza BusinessException con INVALID_CREDENTIALS si el token es invalido o ausente.
 *
 * Soporta el decorador @Public() — si el handler o la clase tienen IS_PUBLIC_KEY = true,
 * el guard se omite y el request continua sin autenticacion JWT.
 * Esto permite tener @UseGuards(JwtAuthGuard) a nivel de clase con endpoints publicos
 * a nivel de metodo (patron de guards mixtos, EPICA-09).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Verificar si el endpoint esta marcado como publico con @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

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
