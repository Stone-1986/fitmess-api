import { JwtAuthGuard } from './jwt-auth.guard.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';

// ── Suite principal ────────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
    vi.clearAllMocks();
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
