import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { BusinessException } from '../exceptions/business.exception.js';
import { BusinessError } from '../exceptions/business-error.enum.js';

// ── Suite principal ────────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
    vi.clearAllMocks();
  });

  // ── canActivate() ────────────────────────────────────────────────────────────
  //
  // Estaba sin cubrir (hallazgo #2b): las líneas del chequeo de @Public() y la
  // delegación a Passport nunca se ejecutaban. Es la decisión de si una request
  // necesita token o no — la puerta de entrada de toda la API.

  describe('canActivate()', () => {
    function buildContext(): ExecutionContext {
      return {
        getHandler: () => () => undefined,
        getClass: () => class {},
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as unknown as ExecutionContext;
    }

    it('deja pasar sin token cuando el endpoint está marcado con @Public()', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const superSpy = vi.spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype) as {
          canActivate: () => boolean;
        },
        'canActivate',
      );

      expect(guard.canActivate(buildContext())).toBe(true);
      // No basta con que devuelva true: lo que importa es que NO haya delegado
      // en Passport, porque delegar implicaría exigir el token.
      expect(superSpy).not.toHaveBeenCalled();
    });

    it('delega en Passport cuando el endpoint NO es público', () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const superSpy = vi
        .spyOn(
          Object.getPrototypeOf(JwtAuthGuard.prototype) as {
            canActivate: () => boolean;
          },
          'canActivate',
        )
        .mockReturnValue(true);

      expect(guard.canActivate(buildContext())).toBe(true);
      expect(superSpy).toHaveBeenCalledTimes(1);
    });

    it('delega en Passport cuando el metadato @Public() no existe', () => {
      // getAllAndOverride devuelve undefined si el decorador no se aplicó:
      // la ausencia de marca significa "protegido", nunca "público".
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const superSpy = vi
        .spyOn(
          Object.getPrototypeOf(JwtAuthGuard.prototype) as {
            canActivate: () => boolean;
          },
          'canActivate',
        )
        .mockReturnValue(true);

      guard.canActivate(buildContext());

      expect(superSpy).toHaveBeenCalledTimes(1);
    });

    it('consulta el metadato tanto en el handler como en la clase', () => {
      const spy = vi
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(true);

      guard.canActivate(buildContext());

      // Sin el segundo nivel, un @Public() a nivel de controller no tendría efecto.
      expect(spy.mock.calls[0][1]).toHaveLength(2);
    });
  });

  // ── handleRequest() ──────────────────────────────────────────────────────────

  describe('handleRequest()', () => {
    it('retorna el usuario cuando no hay error y el usuario esta presente', () => {
      // Arrange
      const mockUser = {
        id: 'user-id',
        email: 'test@test.com',
        role: 'ATHLETE',
      };

      // Act
      const result = guard.handleRequest(null, mockUser);

      // Assert
      expect(result).toBe(mockUser);
    });

    it('lanza BusinessException INVALID_CREDENTIALS cuando hay un error', () => {
      // Act & Assert
      expect(() =>
        guard.handleRequest(new Error('Token invalid'), null),
      ).toThrow(BusinessException);
      expect(() =>
        guard.handleRequest(new Error('Token invalid'), null),
      ).toThrowError(
        expect.objectContaining({
          errorEntry: BusinessError.INVALID_CREDENTIALS,
        }),
      );
    });

    it('lanza BusinessException INVALID_CREDENTIALS cuando el usuario es false (token ausente)', () => {
      // Act & Assert
      expect(() => guard.handleRequest(null, false)).toThrow(BusinessException);
      expect(() => guard.handleRequest(null, false)).toThrowError(
        expect.objectContaining({
          errorEntry: BusinessError.INVALID_CREDENTIALS,
        }),
      );
    });

    it('el mensaje de error menciona token invalido o ausente', () => {
      // Act
      let errorDetail = '';
      try {
        guard.handleRequest(null, false);
      } catch (e) {
        if (e instanceof BusinessException) {
          errorDetail = e.detail;
        }
      }

      // Assert
      expect(errorDetail).toContain('Token');
    });
  });
});
