import { describe, it, expect } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthUser } from '../types/auth-user.interface.js';
import { UserRole } from '../../../../generated/prisma/index.js';

/**
 * `createParamDecorator` devuelve una factory de decorador, no la función que
 * corre en cada request. Esa función está en el primer argumento con el que la
 * factory fue creada, y NestJS la expone en el metadato
 * `__routeParamHandler__` del decorador aplicado.
 *
 * Extraerla es la única forma de ejercitar la lógica sin levantar un módulo
 * entero. Por eso el decorador estaba en 33% de cobertura: el cuerpo nunca se
 * ejecutaba en tests unitarios.
 */
function extraerHandler(): (data: unknown, ctx: ExecutionContext) => AuthUser {
  class Fixture {
    metodo(@CurrentUser() user: AuthUser): AuthUser {
      return user;
    }
  }

  const metadata = Reflect.getMetadata(
    '__routeArguments__',
    Fixture,
    'metodo',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => AuthUser }
  >;

  const entrada = Object.values(metadata)[0];
  return entrada.factory;
}

function buildContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('CurrentUser', () => {
  it('extrae el usuario que la JwtStrategy dejó en el request', () => {
    const handler = extraerHandler();
    const user: AuthUser = {
      id: 'user-1',
      email: 'coach@test.com',
      role: UserRole.COACH,
    };

    expect(handler(undefined, buildContext(user))).toEqual(user);
  });

  it('devuelve undefined si el guard no pobló request.user', () => {
    const handler = extraerHandler();

    expect(handler(undefined, buildContext(undefined))).toBeUndefined();
  });
});
