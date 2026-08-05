import { ExecutionContext } from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.guard.js';
import { BusinessException } from '../../../common/exceptions/business.exception.js';
import { BusinessError } from '../../../common/exceptions/business-error.enum.js';

// ── Suite principal ────────────────────────────────────────────────────────────

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(() => {
    guard = new LocalAuthGuard();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── canActivate() ────────────────────────────────────────────────────────────

  describe('canActivate()', () => {
    it('delega en AuthGuard(local) para disparar la LocalStrategy de Passport', async () => {
      // Arrange — el padre es la clase mixin que devuelve AuthGuard('local')
      const parentPrototype = Object.getPrototypeOf(
        LocalAuthGuard.prototype,
      ) as {
        canActivate: (context: ExecutionContext) => boolean;
      };
      const superCanActivate = vi
        .spyOn(parentPrototype, 'canActivate')
        .mockReturnValue(true);
      const context = {} as ExecutionContext;

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(superCanActivate).toHaveBeenCalledWith(context);
      expect(result).toBe(true);
    });
  });

  // ── handleRequest() ──────────────────────────────────────────────────────────

  describe('handleRequest()', () => {
    it('retorna el usuario cuando la validacion fue exitosa', () => {
      // Arrange
      const mockUser = { id: 'user-uuid-001', email: 'atleta@test.com' };

      // Act
      const result = guard.handleRequest(null, mockUser);

      // Assert
      expect(result).toBe(mockUser);
    });

    it('preserva ACCOUNT_TEMPORARILY_LOCKED en vez de degradarla a 401', () => {
      // Arrange — el bloqueo por fuerza bruta responde 429. Si el guard lo
      // reemplazara por INVALID_CREDENTIALS, el cliente no sabria que debe
      // esperar y seguiria reintentando (HU-004, CA-4).
      const bloqueo = new BusinessException(
        BusinessError.ACCOUNT_TEMPORARILY_LOCKED,
        'Cuenta bloqueada por 15 minutos.',
      );

      // Act & Assert
      expect(() => guard.handleRequest(bloqueo, false)).toThrow(bloqueo);
    });

    it('preserva cualquier BusinessException que venga de la strategy', () => {
      // Arrange
      const exception = new BusinessException(
        BusinessError.COACH_NOT_APPROVED,
        'Tu solicitud aun esta pendiente de aprobacion.',
      );

      // Act & Assert
      expect(() => guard.handleRequest(exception, false)).toThrow(exception);
    });

    it('convierte un error inesperado en INVALID_CREDENTIALS', () => {
      // Arrange — un fallo de infraestructura no debe filtrar su mensaje
      const error = new Error('ECONNREFUSED 127.0.0.1:5432');

      // Act & Assert
      expect(() => guard.handleRequest(error, false)).toThrow(
        BusinessException,
      );
      expect(() => guard.handleRequest(error, false)).toThrowError(
        expect.objectContaining({
          errorEntry: BusinessError.INVALID_CREDENTIALS,
        }),
      );
    });

    it('no filtra el mensaje del error original al cliente', () => {
      // Arrange
      const error = new Error('ECONNREFUSED db.internal.fitmess.co:5432');

      // Act
      let detail = '';
      try {
        guard.handleRequest(error, false);
      } catch (e) {
        if (e instanceof BusinessException) detail = e.detail;
      }

      // Assert
      expect(detail).not.toContain('ECONNREFUSED');
      expect(detail).not.toContain('db.internal.fitmess.co');
      expect(detail).toContain('Credenciales invalidas');
    });

    it('lanza INVALID_CREDENTIALS cuando no hay error pero tampoco usuario', () => {
      // Arrange — Passport devuelve user=false si la strategy no valido
      // Act & Assert
      expect(() => guard.handleRequest(null, false)).toThrow(BusinessException);
      expect(() => guard.handleRequest(null, false)).toThrowError(
        expect.objectContaining({
          errorEntry: BusinessError.INVALID_CREDENTIALS,
        }),
      );
    });

    it('el mensaje no revela si el email existe — anti-enumeracion', () => {
      // Arrange — Ley 1273/2009 + OWASP: la respuesta es identica exista o no
      // el usuario, para no permitir enumerar cuentas registradas.
      let detail = '';
      try {
        guard.handleRequest(null, false);
      } catch (e) {
        if (e instanceof BusinessException) detail = e.detail;
      }

      // Assert
      expect(detail).not.toMatch(/no (existe|encontrad|registrad)/i);
      expect(detail).toContain('correo electronico y contrasena');
    });
  });
});
