import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service.js';
import { User } from '../../../../generated/prisma/index.js';

/**
 * LocalStrategy — valida email + password via Passport.
 *
 * Popula request.user con el User validado antes de llegar al controller.
 * NUNCA loggea la password (Ley 1273/2009).
 * Lanza BusinessException si las credenciales son invalidas o la cuenta esta bloqueada.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    return this.authService.validateCredentials(email, password);
  }
}
