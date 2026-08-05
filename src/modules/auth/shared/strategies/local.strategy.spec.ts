import { LocalStrategy } from './local.strategy.js';
import { AuthService } from '../../core/auth.service.js';
import { BusinessException } from '../../../common/exceptions/business.exception.js';
import { BusinessError } from '../../../common/exceptions/business-error.enum.js';
import {
  User,
  UserRole,
  IdentificationType,
} from '../../../../../generated/prisma/index.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-uuid-001',
  email: 'atleta@test.com',
  passwordHash: '$2b$10$hash',
  role: UserRole.ATHLETE,
  name: 'Maria Lopez',
  identificationType: IdentificationType.CC,
  identificationNumber: '1098765432',
} as unknown as User;

const authServiceMock = {
  validateCredentials: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  beforeEach(() => {
    strategy = new LocalStrategy(authServiceMock as unknown as AuthService);
    vi.clearAllMocks();
  });

  it('se configura con email como usernameField, no con el username por defecto', () => {
    // Assert — el contrato de login usa `email`; passport-local usa `username`
    // por defecto y no encontraria el campo en el body.
    const config = (strategy as unknown as { _usernameField: string })
      ._usernameField;
    expect(config).toBe('email');
  });

  // ── validate() ───────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('delega a AuthService.validateCredentials con email y password', async () => {
      // Arrange
      authServiceMock.validateCredentials.mockResolvedValue(mockUser);

      // Act
      await strategy.validate('atleta@test.com', 'Password123!');

      // Assert
      expect(authServiceMock.validateCredentials).toHaveBeenCalledWith(
        'atleta@test.com',
        'Password123!',
      );
    });

    it('retorna el User validado — Passport lo adjunta a request.user', async () => {
      // Arrange
      authServiceMock.validateCredentials.mockResolvedValue(mockUser);

      // Act
      const result = await strategy.validate('atleta@test.com', 'Password123!');

      // Assert
      expect(result).toBe(mockUser);
    });

    it('propaga INVALID_CREDENTIALS sin transformarla', async () => {
      // Arrange
      const exception = new BusinessException(
        BusinessError.INVALID_CREDENTIALS,
        'Credenciales invalidas.',
      );
      authServiceMock.validateCredentials.mockRejectedValue(exception);

      // Act & Assert
      await expect(
        strategy.validate('atleta@test.com', 'incorrecta'),
      ).rejects.toBe(exception);
    });

    it('propaga ACCOUNT_TEMPORARILY_LOCKED sin transformarla', async () => {
      // Arrange — el bloqueo por fuerza bruta es 429, no 401: si la strategy
      // lo convirtiera a credenciales invalidas se perderia la distincion.
      const exception = new BusinessException(
        BusinessError.ACCOUNT_TEMPORARILY_LOCKED,
        'Cuenta bloqueada por 15 minutos.',
      );
      authServiceMock.validateCredentials.mockRejectedValue(exception);

      // Act & Assert
      await expect(
        strategy.validate('atleta@test.com', 'Password123!'),
      ).rejects.toThrowError(
        expect.objectContaining({
          errorEntry: BusinessError.ACCOUNT_TEMPORARILY_LOCKED,
        }),
      );
    });

    it('no transforma ni inspecciona la password — solo la pasa al service', async () => {
      // Arrange — Ley 1273/2009: la strategy nunca manipula ni loggea la password
      authServiceMock.validateCredentials.mockResolvedValue(mockUser);
      const password = 'P@ssw0rd-Con-Simbolos-#$%';

      // Act
      await strategy.validate('ATLETA@TEST.COM', password);

      // Assert — email y password llegan tal cual; la normalizacion a minusculas
      // es responsabilidad del service, no de la strategy
      expect(authServiceMock.validateCredentials).toHaveBeenCalledWith(
        'ATLETA@TEST.COM',
        password,
      );
    });
  });
});
