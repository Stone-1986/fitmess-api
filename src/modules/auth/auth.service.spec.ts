import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  UserRole,
  DocumentType,
  CoachRequestStatus,
} from '../../../generated/prisma/index.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { RegisterAthleteDto } from './dto/register-athlete.dto.js';
import { RegisterCoachDto } from './dto/register-coach.dto.js';
import { IdentificationType } from './enums/identification-type.enum.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-001';
const COACH_USER_ID = 'user-uuid-002';
const COACH_REQUEST_ID = 'coach-req-uuid-001';
const ADMIN_ID = 'admin-uuid-001';

const baseAthleteDto: RegisterAthleteDto = {
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
};

const baseCoachDto: RegisterCoachDto = {
  name: 'Carlos Ramirez',
  email: 'coach@test.com',
  password: 'Password123!',
  phone: '3001234567',
  phoneCountryCode: '+57',
  identificationType: IdentificationType.CC,
  identificationNumber: '1023456789',
  planDescription: 'Especialista en fuerza con 5 anos de experiencia.',
  acceptsTermsOfService: true,
  acceptsHabeasData: true,
  termsDocumentVersion: 'v2.0',
  personalDataDocumentVersion: 'v1.0',
};

const mockUser = {
  id: USER_ID,
  email: 'atleta@test.com',
  passwordHash: '$2b$10$hashedpassword',
  role: UserRole.ATHLETE,
  name: 'Maria Lopez',
  phone: '3107654321',
  phoneCountryCode: '+57',
  identificationType: IdentificationType.CC,
  identificationNumber: '1098765432',
  dateOfBirth: new Date('1995-06-15'),
  avatarUrl: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date('2026-03-01'),
  updatedAt: new Date('2026-03-01'),
};

const mockCoachUser = {
  ...mockUser,
  id: COACH_USER_ID,
  email: 'coach@test.com',
  role: UserRole.COACH,
  identificationNumber: '1023456789',
};

// ── Mock de PrismaService ──────────────────────────────────────────────────────

const prismaMock = {
  $transaction: vi.fn(),
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  legalAcceptance: {
    create: vi.fn(),
  },
  coachRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
  },
};

// ── Mock de JwtService ─────────────────────────────────────────────────────────

const jwtMock = {
  sign: vi.fn().mockReturnValue('jwt-access-token'),
};

// ── Mock de EventEmitter2 ──────────────────────────────────────────────────────

const eventEmitterMock = {
  emit: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    vi.clearAllMocks();
  });

  // ── registerAthlete() ────────────────────────────────────────────────────────

  describe('registerAthlete()', () => {
    it('registra atleta exitosamente con User + HABEAS_DATA + TERMS_OF_SERVICE en $transaction → emite user.registered', async () => {
      // Arrange
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: vi.fn().mockResolvedValue(mockUser) },
            legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(txMock);
        },
      );

      // Act
      const result = await service.registerAthlete(
        baseAthleteDto,
        '127.0.0.1',
        'test-agent',
      );

      // Assert
      expect(result.id).toBe(USER_ID);
      expect(result.email).toBe('atleta@test.com');
      expect(result.role).toBe(UserRole.ATHLETE);
      expect(result.createdAt).toBeDefined();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith('user.registered', {
        userId: USER_ID,
        role: UserRole.ATHLETE,
      });
    });

    it('crea HABEAS_DATA y TERMS_OF_SERVICE como registros separados en la transaccion', async () => {
      // Arrange
      const legalCreateMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: vi.fn().mockResolvedValue(mockUser) },
            legalAcceptance: { create: legalCreateMock },
          };
          return fn(txMock);
        },
      );

      // Act
      await service.registerAthlete(baseAthleteDto, '127.0.0.1', 'test-agent');

      // Assert — dos registros legales separados (HABEAS_DATA y TERMS_OF_SERVICE)
      expect(legalCreateMock).toHaveBeenCalledTimes(2);
      expect(legalCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: DocumentType.HABEAS_DATA,
          }),
        }),
      );
      expect(legalCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentType: DocumentType.TERMS_OF_SERVICE,
          }),
        }),
      );
    });

    it('HEALTH_DATA_CONSENT NO se registra en el registro del atleta', async () => {
      // Arrange
      const legalCreateMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: vi.fn().mockResolvedValue(mockUser) },
            legalAcceptance: { create: legalCreateMock },
          };
          return fn(txMock);
        },
      );

      // Act
      await service.registerAthlete(baseAthleteDto, '127.0.0.1', 'test-agent');

      // Assert
      const allCalls = legalCreateMock.mock.calls as Array<
        [{ data: { documentType: DocumentType } }]
      >;
      const documentTypes = allCalls.map((call) => call[0].data.documentType);
      expect(documentTypes).not.toContain(DocumentType.HEALTH_DATA_CONSENT);
    });

    it('normaliza el email a minusculas antes de persistir', async () => {
      // Arrange
      const userCreateMock = vi
        .fn()
        .mockResolvedValue({ ...mockUser, email: 'atleta@test.com' });
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: userCreateMock },
            legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(txMock);
        },
      );
      const dtoWithUpperEmail = { ...baseAthleteDto, email: 'ATLETA@TEST.COM' };

      // Act
      await service.registerAthlete(
        dtoWithUpperEmail,
        '127.0.0.1',
        'test-agent',
      );

      // Assert
      expect(userCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'atleta@test.com' }),
        }),
      );
    });

    it('lanza BusinessException DUPLICATE_ENTITY con mensaje neutro ante email o identificationNumber duplicado', async () => {
      // Arrange — simular error P2002 de Prisma
      const prismaP2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      prismaMock.$transaction.mockRejectedValue(prismaP2002Error);

      // Act & Assert
      await expect(
        service.registerAthlete(baseAthleteDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(BusinessException);

      await expect(
        service.registerAthlete(baseAthleteDto, '127.0.0.1', 'test-agent'),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.DUPLICATE_ENTITY,
      });
    });

    it('el mensaje de error ante duplicado es neutro (no confirma si el email o el numero esta tomado)', async () => {
      // Arrange
      const prismaP2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      prismaMock.$transaction.mockRejectedValue(prismaP2002Error);

      // Act
      let errorDetail = '';
      try {
        await service.registerAthlete(
          baseAthleteDto,
          '127.0.0.1',
          'test-agent',
        );
      } catch (e) {
        if (e instanceof BusinessException) {
          errorDetail = e.detail;
        }
      }

      // Assert — el mensaje no menciona "email" ni "identificacion" especificamente
      expect(errorDetail).toBe(
        'Estos datos ya estan registrados en la plataforma.',
      );
    });

    it('lanza TechnicalException DATABASE_ERROR ante error de base de datos no P2002', async () => {
      // Arrange
      prismaMock.$transaction.mockRejectedValue(new Error('Connection lost'));

      // Act & Assert
      await expect(
        service.registerAthlete(baseAthleteDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(TechnicalException);
    });

    it('hashea el password con bcrypt antes de persistir (NO almacena texto plano)', async () => {
      // Arrange
      const userCreateMock = vi.fn().mockResolvedValue(mockUser);
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: userCreateMock },
            legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(txMock);
        },
      );

      // Act
      await service.registerAthlete(baseAthleteDto, '127.0.0.1', 'test-agent');

      // Assert — el passwordHash enviado a Prisma NO debe ser el password original
      const callArg = (
        userCreateMock.mock.calls[0] as [{ data: { passwordHash: string } }]
      )[0].data;
      expect(callArg.passwordHash).not.toBe('Password123!');
      expect(await bcrypt.compare('Password123!', callArg.passwordHash)).toBe(
        true,
      );
    });
  });

  // ── registerCoach() ──────────────────────────────────────────────────────────

  describe('registerCoach()', () => {
    it('registra coach exitosamente con User + CoachRequest + TERMS_OF_SERVICE + HABEAS_DATA en $transaction → emite coach.request.created', async () => {
      // Arrange
      const mockCoachRequest = {
        id: COACH_REQUEST_ID,
        status: CoachRequestStatus.PENDING,
        createdAt: new Date('2026-03-01'),
      };
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: vi.fn().mockResolvedValue(mockCoachUser) },
            coachRequest: {
              create: vi.fn().mockResolvedValue(mockCoachRequest),
            },
            legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(txMock);
        },
      );

      // Act
      const result = await service.registerCoach(
        baseCoachDto,
        '127.0.0.1',
        'test-agent',
      );

      // Assert
      expect(result.id).toBe(COACH_REQUEST_ID);
      expect(result.status).toBe(CoachRequestStatus.PENDING);
      expect(result.message).toBeDefined();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'coach.request.created',
        {
          coachRequestId: COACH_REQUEST_ID,
        },
      );
    });

    it('crea CoachRequest con status PENDING', async () => {
      // Arrange
      const coachRequestCreateMock = vi.fn().mockResolvedValue({
        id: COACH_REQUEST_ID,
        status: CoachRequestStatus.PENDING,
        createdAt: new Date(),
      });
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: vi.fn().mockResolvedValue(mockCoachUser) },
            coachRequest: { create: coachRequestCreateMock },
            legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(txMock);
        },
      );

      // Act
      await service.registerCoach(baseCoachDto, '127.0.0.1', 'test-agent');

      // Assert
      expect(coachRequestCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: CoachRequestStatus.PENDING }),
        }),
      );
    });

    it('crea TERMS_OF_SERVICE y HABEAS_DATA como registros separados e independientes', async () => {
      // Arrange
      const legalCreateMock = vi.fn().mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
          const txMock = {
            user: { create: vi.fn().mockResolvedValue(mockCoachUser) },
            coachRequest: {
              create: vi.fn().mockResolvedValue({
                id: COACH_REQUEST_ID,
                status: CoachRequestStatus.PENDING,
                createdAt: new Date(),
              }),
            },
            legalAcceptance: { create: legalCreateMock },
          };
          return fn(txMock);
        },
      );

      // Act
      await service.registerCoach(baseCoachDto, '127.0.0.1', 'test-agent');

      // Assert — dos registros legales separados
      expect(legalCreateMock).toHaveBeenCalledTimes(2);
      const allCalls = legalCreateMock.mock.calls as Array<
        [{ data: { documentType: DocumentType } }]
      >;
      const documentTypes = allCalls.map((call) => call[0].data.documentType);
      expect(documentTypes).toContain(DocumentType.TERMS_OF_SERVICE);
      expect(documentTypes).toContain(DocumentType.HABEAS_DATA);
    });

    it('lanza BusinessException DUPLICATE_ENTITY con mensaje neutro ante duplicados (anti-enumeracion)', async () => {
      // Arrange
      const prismaP2002Error = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      prismaMock.$transaction.mockRejectedValue(prismaP2002Error);

      // Act & Assert
      await expect(
        service.registerCoach(baseCoachDto, '127.0.0.1', 'test-agent'),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.DUPLICATE_ENTITY,
        detail: 'Estos datos ya estan registrados en la plataforma.',
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante error de base de datos generico', async () => {
      // Arrange
      prismaMock.$transaction.mockRejectedValue(new Error('DB crash'));

      // Act & Assert
      await expect(
        service.registerCoach(baseCoachDto, '127.0.0.1', 'test-agent'),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── validateCredentials() ────────────────────────────────────────────────────

  describe('validateCredentials()', () => {
    it('retorna el usuario cuando las credenciales son correctas y resetea contador si habia intentos fallidos', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const userWithAttempts = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 2,
      };
      prismaMock.user.findUnique.mockResolvedValue(userWithAttempts);
      prismaMock.user.update.mockResolvedValue({
        ...userWithAttempts,
        failedLoginAttempts: 0,
      });

      // Act
      const result = await service.validateCredentials(
        'atleta@test.com',
        'Password123!',
      );

      // Assert
      expect(result.id).toBe(USER_ID);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });

    it('lanza BusinessException INVALID_CREDENTIALS cuando el usuario no existe (mensaje identico — anti-enumeracion)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.validateCredentials('noexiste@test.com', 'cualquier'),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_CREDENTIALS,
      });
    });

    it('lanza BusinessException INVALID_CREDENTIALS cuando la password es incorrecta (mismo mensaje que usuario inexistente)', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('CorrectPassword!', 10);
      const user = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
      };
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.user.update.mockResolvedValue({});

      // Act & Assert
      const error = await service
        .validateCredentials('atleta@test.com', 'WrongPassword!')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BusinessException);
      expect(error.errorEntry).toEqual(BusinessError.INVALID_CREDENTIALS);
    });

    it('INVALID_CREDENTIALS tiene el mismo mensaje para usuario inexistente y password incorrecto (anti-enumeracion)', async () => {
      // Arrange — usuario inexistente
      prismaMock.user.findUnique.mockResolvedValue(null);
      const errorNoUser = await service
        .validateCredentials('no@existe.com', 'pass')
        .catch((e) => e as BusinessException);

      // Arrange — password incorrecta
      const hashedPassword = await bcrypt.hash('Correct!', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 0,
      });
      prismaMock.user.update.mockResolvedValue({});
      const errorWrongPass = await service
        .validateCredentials('atleta@test.com', 'Wrong!')
        .catch((e) => e as BusinessException);

      // Assert — mismo mensaje
      expect(errorNoUser.detail).toBe(errorWrongPass.detail);
    });

    it('incrementa failedLoginAttempts tras password incorrecta', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('CorrectPass!', 10);
      const user = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 1,
      };
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.user.update.mockResolvedValue({});

      // Act
      await service
        .validateCredentials('atleta@test.com', 'WrongPass!')
        .catch(() => {});

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 2 }),
        }),
      );
    });

    it('bloquea la cuenta al llegar a 5 intentos fallidos consecutivos', async () => {
      // Arrange — usuario con 4 intentos previos
      const hashedPassword = await bcrypt.hash('CorrectPass!', 10);
      const user = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 4,
      };
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.user.update.mockResolvedValue({});

      // Act
      await service
        .validateCredentials('atleta@test.com', 'WrongPass!')
        .catch(() => {});

      // Assert — debe persistir lockedUntil
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('lanza BusinessException ACCOUNT_TEMPORARILY_LOCKED cuando la cuenta esta bloqueada', async () => {
      // Arrange — usuario con lockedUntil en el futuro
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      const lockedUser = { ...mockUser, lockedUntil, failedLoginAttempts: 5 };
      prismaMock.user.findUnique.mockResolvedValue(lockedUser);

      // Act & Assert
      await expect(
        service.validateCredentials('atleta@test.com', 'cualquier'),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.ACCOUNT_TEMPORARILY_LOCKED,
      });
    });

    it('resetea el contador si el bloqueo ya expiro antes de validar credenciales', async () => {
      // Arrange — usuario con lockedUntil en el pasado (bloqueo expirado)
      const pastLock = new Date(Date.now() - 1000);
      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const userWithExpiredLock = {
        ...mockUser,
        passwordHash: hashedPassword,
        failedLoginAttempts: 5,
        lockedUntil: pastLock,
      };
      prismaMock.user.findUnique.mockResolvedValue(userWithExpiredLock);
      // Primer update: reset del bloqueo expirado; segundo update: reset en login exitoso
      prismaMock.user.update.mockResolvedValue({
        ...userWithExpiredLock,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      // Act
      const result = await service.validateCredentials(
        'atleta@test.com',
        'Password123!',
      );

      // Assert — el reset se llama
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('normaliza email a minusculas en la busqueda', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act
      await service
        .validateCredentials('ATLETA@TEST.COM', 'pass')
        .catch(() => {});

      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'atleta@test.com' } }),
      );
    });
  });

  // ── login() ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('genera accessToken y refreshToken para usuario ATHLETE', async () => {
      // Arrange
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await service.login(mockUser as never);

      // Assert
      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.refreshToken).toMatch(/^rt_/);
      expect(result.expiresIn).toBe(3600);
      expect(result.user.id).toBe(USER_ID);
      expect(result.user.email).toBe('atleta@test.com');
      expect(result.user.role).toBe(UserRole.ATHLETE);
    });

    it('genera accessToken para usuario ADMIN sin verificar CoachRequest', async () => {
      // Arrange
      const adminUser = { ...mockUser, id: ADMIN_ID, role: UserRole.ADMIN };
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await service.login(adminUser as never);

      // Assert
      expect(result.accessToken).toBeDefined();
      expect(prismaMock.coachRequest.findUnique).not.toHaveBeenCalled();
    });

    it('lanza BusinessException COACH_NOT_APPROVED cuando el coach tiene solicitud PENDING', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue({
        status: CoachRequestStatus.PENDING,
      });

      // Act & Assert
      await expect(service.login(mockCoachUser as never)).rejects.toMatchObject(
        {
          errorEntry: BusinessError.COACH_NOT_APPROVED,
        },
      );
    });

    it('lanza BusinessException COACH_NOT_APPROVED cuando el coach tiene solicitud REJECTED', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue({
        status: CoachRequestStatus.REJECTED,
      });

      // Act & Assert
      await expect(service.login(mockCoachUser as never)).rejects.toMatchObject(
        {
          errorEntry: BusinessError.COACH_NOT_APPROVED,
        },
      );
    });

    it('lanza BusinessException COACH_NOT_APPROVED cuando el coach no tiene solicitud', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(mockCoachUser as never)).rejects.toMatchObject(
        {
          errorEntry: BusinessError.COACH_NOT_APPROVED,
        },
      );
    });

    it('genera tokens para coach con solicitud APPROVED', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue({
        status: CoachRequestStatus.APPROVED,
      });
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await service.login(mockCoachUser as never);

      // Assert
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toMatch(/^rt_/);
    });

    it('persiste el refreshToken hasheado (SHA-256) y NO el token opaco', async () => {
      // Arrange
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await service.login(mockUser as never);

      // Assert — el tokenHash en la BD no debe ser igual al refreshToken retornado
      const createCall = (
        prismaMock.refreshToken.create.mock.calls[0] as [
          { data: { tokenHash: string } },
        ]
      )[0];
      expect(createCall.data.tokenHash).not.toBe(result.refreshToken);
      expect(createCall.data.tokenHash).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('el refreshToken retornado empieza con rt_ (token opaco)', async () => {
      // Arrange
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await service.login(mockUser as never);

      // Assert
      expect(result.refreshToken.startsWith('rt_')).toBe(true);
    });

    it('lanza TechnicalException DATABASE_ERROR si falla la persistencia del refreshToken', async () => {
      // Arrange
      prismaMock.refreshToken.create.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.login(mockUser as never)).rejects.toThrow(
        TechnicalException,
      );
    });

    it('NUNCA incluye el accessToken ni el refreshToken en propiedades de la excepcion (no se loggea)', async () => {
      // Arrange — verificar que el resultado no expone tokens en el objeto de usuario
      prismaMock.refreshToken.create.mockResolvedValue({});

      // Act
      const result = await service.login(mockUser as never);

      // Assert — el objeto user del resultado NO debe contener tokens
      const userKeys = Object.keys(result.user);
      expect(userKeys).not.toContain('accessToken');
      expect(userKeys).not.toContain('refreshToken');
      expect(userKeys).not.toContain('passwordHash');
    });
  });
});
