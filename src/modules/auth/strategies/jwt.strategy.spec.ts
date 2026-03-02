import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy.js';
import { UserRole } from '../../../../generated/prisma/index.js';

// ── Mock de ConfigService ─────────────────────────────────────────────────────

const configServiceMock = {
  getOrThrow: vi.fn().mockReturnValue('test-jwt-secret'),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    vi.clearAllMocks();
  });

  describe('validate()', () => {
    it('retorna AuthUser con id, email y role del payload JWT', () => {
      // Arrange
      const payload: JwtPayload = {
        sub: 'user-uuid-001',
        email: 'usuario@test.com',
        role: UserRole.ATHLETE,
      };

      // Act
      const result = strategy.validate(payload);

      // Assert
      expect(result.id).toBe('user-uuid-001');
      expect(result.email).toBe('usuario@test.com');
      expect(result.role).toBe(UserRole.ATHLETE);
    });

    it('retorna AuthUser con role ADMIN del payload JWT', () => {
      // Arrange
      const payload: JwtPayload = {
        sub: 'admin-uuid-001',
        email: 'admin@test.com',
        role: UserRole.ADMIN,
      };

      // Act
      const result = strategy.validate(payload);

      // Assert
      expect(result.id).toBe('admin-uuid-001');
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('retorna AuthUser con role COACH del payload JWT', () => {
      // Arrange
      const payload: JwtPayload = {
        sub: 'coach-uuid-001',
        email: 'coach@test.com',
        role: UserRole.COACH,
      };

      // Act
      const result = strategy.validate(payload);

      // Assert
      expect(result.id).toBe('coach-uuid-001');
      expect(result.role).toBe(UserRole.COACH);
    });

    it('mapea sub del payload a id en AuthUser', () => {
      // Arrange
      const payload: JwtPayload = {
        sub: 'some-uuid',
        email: 'test@test.com',
        role: UserRole.ATHLETE,
      };

      // Act
      const result = strategy.validate(payload);

      // Assert — 'sub' del JWT se convierte en 'id' del AuthUser
      expect(result).toEqual({
        id: 'some-uuid',
        email: 'test@test.com',
        role: UserRole.ATHLETE,
      });
    });
  });
});
