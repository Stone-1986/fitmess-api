/**
 * Tests unitarios de AuthController.
 *
 * El controller es THIN: solo extrae ip/user-agent del request y delega al
 * service. Estos tests instancian la clase REAL via @nestjs/testing y mockean
 * unicamente AuthService.
 *
 * Historico: hasta 2026-08-05 este spec construia una replica del controller a
 * mano ("controllerBehavior") por un supuesto fallo al importar 'express'. Los
 * tests pasaban sin ejecutar una sola linea del controller real — cobertura 0%.
 * Se verifico que el import funciona correctamente y se reconectaron.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  UserRole,
  CoachRequestStatus,
  IdentificationType,
} from '../../../../generated/prisma/index.js';
import { RegisterAthleteDto } from './dto/register-athlete.dto.js';
import { RegisterCoachDto } from './dto/register-coach.dto.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-001';
const COACH_REQUEST_ID = 'coach-req-uuid-001';

const mockAthleteResponse = {
  id: USER_ID,
  name: 'Maria Lopez',
  email: 'atleta@test.com',
  role: UserRole.ATHLETE,
  identificationType: IdentificationType.CC,
  identificationNumber: '1098765432',
  dateOfBirth: '1995-06-15',
  avatarUrl: undefined,
  createdAt: new Date('2026-03-01'),
};

const mockCoachRequestResponse = {
  id: COACH_REQUEST_ID,
  status: CoachRequestStatus.PENDING,
  createdAt: new Date('2026-03-01'),
  message: 'Solicitud recibida. El administrador revisara tu perfil.',
};

const mockAuthTokenResponse = {
  accessToken: 'jwt-access-token',
  refreshToken: 'rt_abc123',
  expiresIn: 3600,
  user: { id: USER_ID, email: 'atleta@test.com', role: UserRole.ATHLETE },
};

const baseAthleteDto = {
  name: 'Maria Lopez',
  email: 'atleta@test.com',
  password: 'Password123!',
  phone: '3107654321',
  phoneCountryCode: '+57',
  identificationType: IdentificationType.CC,
  identificationNumber: '1098765432',
  dateOfBirth: '1995-06-15',
  acceptsHabeasData: true,
  acceptsTermsOfService: true,
  personalDataDocumentVersion: 'v1.0',
  termsDocumentVersion: 'v2.0',
} as RegisterAthleteDto;

const baseCoachDto = {
  name: 'Carlos Ramirez',
  email: 'coach@test.com',
  password: 'Password123!',
  phone: '3001234567',
  phoneCountryCode: '+57',
  identificationType: IdentificationType.CC,
  identificationNumber: '1023456789',
  planDescription: 'Especialista en fuerza.',
  acceptsTermsOfService: true,
  acceptsHabeasData: true,
  termsDocumentVersion: 'v2.0',
  personalDataDocumentVersion: 'v1.0',
} as RegisterCoachDto;

// ── Mock de AuthService ────────────────────────────────────────────────────────

const authServiceMock = {
  registerAthlete: vi.fn(),
  registerCoach: vi.fn(),
  registerAdmin: vi.fn(),
  login: vi.fn(),
};

/** Request de express minimo: solo lo que el controller lee. */
function buildRequest(
  ip?: string,
  userAgent?: string,
): Parameters<AuthController['registerAthlete']>[1] {
  return {
    ip,
    headers: userAgent ? { 'user-agent': userAgent } : {},
  } as unknown as Parameters<AuthController['registerAthlete']>[1];
}

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    vi.clearAllMocks();
  });

  it('se instancia correctamente', () => {
    expect(controller).toBeInstanceOf(AuthController);
  });

  // ── registerAthlete() ────────────────────────────────────────────────────────

  describe('registerAthlete() — POST /auth/register', () => {
    it('delega al service con el DTO, ip y user-agent correctos', async () => {
      // Arrange
      authServiceMock.registerAthlete.mockResolvedValue(mockAthleteResponse);

      // Act
      await controller.registerAthlete(
        baseAthleteDto,
        buildRequest('127.0.0.1', 'test-agent'),
      );

      // Assert
      expect(authServiceMock.registerAthlete).toHaveBeenCalledWith(
        baseAthleteDto,
        '127.0.0.1',
        'test-agent',
      );
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      authServiceMock.registerAthlete.mockResolvedValue(mockAthleteResponse);

      // Act
      const result = await controller.registerAthlete(
        baseAthleteDto,
        buildRequest('127.0.0.1', 'test-agent'),
      );

      // Assert
      expect(result).toBe(mockAthleteResponse);
    });

    it('usa 0.0.0.0 cuando el request no trae ip', async () => {
      // Arrange
      authServiceMock.registerAthlete.mockResolvedValue(mockAthleteResponse);

      // Act
      await controller.registerAthlete(
        baseAthleteDto,
        buildRequest(undefined, 'test-agent'),
      );

      // Assert — la ip se persiste en LegalAcceptance (Ley 527/1999)
      expect(authServiceMock.registerAthlete).toHaveBeenCalledWith(
        baseAthleteDto,
        '0.0.0.0',
        'test-agent',
      );
    });

    it("usa 'unknown' cuando el request no trae user-agent", async () => {
      // Arrange
      authServiceMock.registerAthlete.mockResolvedValue(mockAthleteResponse);

      // Act
      await controller.registerAthlete(
        baseAthleteDto,
        buildRequest('127.0.0.1'),
      );

      // Assert
      expect(authServiceMock.registerAthlete).toHaveBeenCalledWith(
        baseAthleteDto,
        '127.0.0.1',
        'unknown',
      );
    });

    it('propaga la excepcion del service sin atraparla', async () => {
      // Arrange — rulesCodigo: los controllers NUNCA hacen try/catch
      const error = new Error('DUPLICATE_ENTITY');
      authServiceMock.registerAthlete.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.registerAthlete(baseAthleteDto, buildRequest('127.0.0.1')),
      ).rejects.toThrow(error);
    });
  });

  // ── registerCoach() ──────────────────────────────────────────────────────────

  describe('registerCoach() — POST /auth/coaches/register', () => {
    it('delega al service con el DTO, ip y user-agent correctos', async () => {
      // Arrange
      authServiceMock.registerCoach.mockResolvedValue(mockCoachRequestResponse);

      // Act
      await controller.registerCoach(
        baseCoachDto,
        buildRequest('10.0.0.5', 'coach-agent'),
      );

      // Assert
      expect(authServiceMock.registerCoach).toHaveBeenCalledWith(
        baseCoachDto,
        '10.0.0.5',
        'coach-agent',
      );
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      authServiceMock.registerCoach.mockResolvedValue(mockCoachRequestResponse);

      // Act
      const result = await controller.registerCoach(
        baseCoachDto,
        buildRequest('10.0.0.5', 'coach-agent'),
      );

      // Assert
      expect(result).toBe(mockCoachRequestResponse);
    });

    it('aplica los mismos defaults de ip y user-agent', async () => {
      // Arrange
      authServiceMock.registerCoach.mockResolvedValue(mockCoachRequestResponse);

      // Act
      await controller.registerCoach(baseCoachDto, buildRequest());

      // Assert
      expect(authServiceMock.registerCoach).toHaveBeenCalledWith(
        baseCoachDto,
        '0.0.0.0',
        'unknown',
      );
    });
  });

  // ── login() ──────────────────────────────────────────────────────────────────

  describe('login() — POST /auth/login', () => {
    it('delega al service el user que LocalAuthGuard adjunto al request', async () => {
      // Arrange — LocalStrategy valida credenciales y adjunta req.user
      authServiceMock.login.mockResolvedValue(mockAuthTokenResponse);
      const user = { id: USER_ID, email: 'atleta@test.com' };
      const req = { user } as Parameters<AuthController['login']>[0];

      // Act
      await controller.login(req);

      // Assert
      expect(authServiceMock.login).toHaveBeenCalledWith(user);
    });

    it('retorna el token del service sin modificarlo', async () => {
      // Arrange
      authServiceMock.login.mockResolvedValue(mockAuthTokenResponse);
      const req = { user: { id: USER_ID } } as Parameters<
        AuthController['login']
      >[0];

      // Act
      const result = await controller.login(req);

      // Assert
      expect(result).toBe(mockAuthTokenResponse);
    });

    it('propaga COACH_NOT_APPROVED sin atraparla', async () => {
      // Arrange
      const error = new Error('COACH_NOT_APPROVED');
      authServiceMock.login.mockRejectedValue(error);
      const req = { user: { id: USER_ID } } as Parameters<
        AuthController['login']
      >[0];

      // Act & Assert
      await expect(controller.login(req)).rejects.toThrow(error);
    });
  });

  // ── Contrato de controller THIN ──────────────────────────────────────────────

  describe('contrato THIN', () => {
    it('expone exactamente los 4 metodos del contrato', () => {
      const metodos = Object.getOwnPropertyNames(
        AuthController.prototype,
      ).filter((m) => m !== 'constructor');

      expect(metodos.sort()).toEqual([
        'login',
        'registerAdmin',
        'registerAthlete',
        'registerCoach',
      ]);
    });
  });
});
