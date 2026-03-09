/**
 * Tests unitarios de AuthService.registerAdmin() — EPICA-09.
 *
 * Archivo separado para mantener el spec principal manejable.
 * Verifica el flujo completo de registro de administrador via token de invitacion.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../core/auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  UserRole,
  DocumentType,
  IdentificationType,
} from '../../../../generated/prisma/index.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../../common/exceptions/technical.exception.js';
import { RegisterAdminDto } from './dto/register-admin.dto.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin-uuid-001';
const INVITATION_ID = 'inv-uuid-001';
const TEST_EMAIL = 'nuevo.admin@fitmess.co';
const RAW_TOKEN = 'a'.repeat(64);
const FUTURE_DATE = new Date(Date.now() + 48 * 60 * 60 * 1000);

const mockAdminUser = {
  id: ADMIN_ID,
  email: TEST_EMAIL,
  passwordHash: '$2b$10$hashedpassword',
  role: UserRole.ADMIN,
  name: 'Carlos Ramirez',
  phone: '3001234567',
  phoneCountryCode: '57',
  identificationType: IdentificationType.CC,
  identificationNumber: '80123456',
  dateOfBirth: new Date('1985-06-15'),
  avatarUrl: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date('2026-03-08'),
  updatedAt: new Date('2026-03-08'),
};

const mockInvitation = {
  id: INVITATION_ID,
  email: TEST_EMAIL,
  expiresAt: FUTURE_DATE,
  tokenUsedAt: null,
};

const baseAdminDto: RegisterAdminDto = {
  invitationToken: RAW_TOKEN,
  name: 'Carlos Ramirez',
  email: TEST_EMAIL,
  password: 'AdminPass789',
  phone: '3001234567',
  phoneCountryCode: '57',
  identificationType: IdentificationType.CC,
  identificationNumber: '80123456',
  acceptsTermsOfService: true,
  termsDocumentVersion: 'v1.0',
  acceptsHabeasData: true,
  personalDataDocumentVersion: 'v1.0',
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

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
  adminInvitation: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  coachRequest: {
    findUnique: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
  },
};

const jwtMock = {
  sign: vi.fn().mockReturnValue('jwt-access-token'),
};

const eventEmitterMock = {
  emit: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AuthService.registerAdmin()', () => {
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

  it('registra administrador exitosamente → User + HABEAS_DATA + TERMS_OF_SERVICE + invitacion marcada en $transaction → emite user.registered', async () => {
    // Arrange
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn().mockResolvedValue({}),
          },
          user: { create: vi.fn().mockResolvedValue(mockAdminUser) },
          legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      },
    );

    // Act
    const result = await service.registerAdmin(
      baseAdminDto,
      '127.0.0.1',
      'test-agent',
    );

    // Assert
    expect(result.id).toBe(ADMIN_ID);
    expect(result.email).toBe(TEST_EMAIL);
    expect(result.role).toBe(UserRole.ADMIN);
    expect(result.name).toBe('Carlos Ramirez');
    expect(result.createdAt).toBeDefined();
    expect(eventEmitterMock.emit).toHaveBeenCalledWith('user.registered', {
      userId: ADMIN_ID,
      role: UserRole.ADMIN,
    });
  });

  it('la $transaction incluye: User.create + LegalAcceptance.create (x2) + AdminInvitation.update(tokenUsedAt)', async () => {
    // Arrange
    let legalCreateMock: ReturnType<typeof vi.fn>;
    let invitationUpdateMock: ReturnType<typeof vi.fn>;

    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        legalCreateMock = vi.fn().mockResolvedValue({});
        invitationUpdateMock = vi.fn().mockResolvedValue({});
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: invitationUpdateMock,
          },
          user: { create: vi.fn().mockResolvedValue(mockAdminUser) },
          legalAcceptance: { create: legalCreateMock },
        };
        return fn(txMock);
      },
    );

    // Act
    await service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent');

    // Assert
    expect(legalCreateMock!).toHaveBeenCalledTimes(2);
    expect(invitationUpdateMock!).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokenUsedAt: expect.any(Date) }),
      }),
    );
  });

  it('crea HABEAS_DATA y TERMS_OF_SERVICE como registros separados (Ley 1581/2012, Ley 527/1999)', async () => {
    // Arrange
    let legalCreateMock: ReturnType<typeof vi.fn>;

    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        legalCreateMock = vi.fn().mockResolvedValue({});
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn().mockResolvedValue({}),
          },
          user: { create: vi.fn().mockResolvedValue(mockAdminUser) },
          legalAcceptance: { create: legalCreateMock },
        };
        return fn(txMock);
      },
    );

    // Act
    await service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent');

    // Assert
    const allCalls = legalCreateMock!.mock.calls as Array<
      [{ data: { documentType: DocumentType } }]
    >;
    const documentTypes = allCalls.map((call) => call[0].data.documentType);
    expect(documentTypes).toContain(DocumentType.HABEAS_DATA);
    expect(documentTypes).toContain(DocumentType.TERMS_OF_SERVICE);
  });

  it('crea User con role ADMIN (nunca ATHLETE ni COACH)', async () => {
    // Arrange
    let userCreateMock: ReturnType<typeof vi.fn>;

    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        userCreateMock = vi.fn().mockResolvedValue(mockAdminUser);
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn().mockResolvedValue({}),
          },
          user: { create: userCreateMock },
          legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      },
    );

    // Act
    await service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent');

    // Assert
    expect(userCreateMock!).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: UserRole.ADMIN }),
      }),
    );
  });

  it('hashea el password con bcrypt antes de persistir (NUNCA texto plano — Ley 1273/2009)', async () => {
    // Arrange
    let userCreateMock: ReturnType<typeof vi.fn>;

    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        userCreateMock = vi.fn().mockResolvedValue(mockAdminUser);
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn().mockResolvedValue({}),
          },
          user: { create: userCreateMock },
          legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      },
    );

    // Act
    await service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent');

    // Assert — el passwordHash almacenado no es el password original
    const callArg = (
      userCreateMock!.mock.calls[0] as [{ data: { passwordHash: string } }]
    )[0].data;
    expect(callArg.passwordHash).not.toBe('AdminPass789');
    expect(await bcrypt.compare('AdminPass789', callArg.passwordHash)).toBe(
      true,
    );
  });

  it('normaliza el email a minusculas antes de persistir', async () => {
    // Arrange
    let userCreateMock: ReturnType<typeof vi.fn>;

    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        userCreateMock = vi
          .fn()
          .mockResolvedValue({ ...mockAdminUser, email: TEST_EMAIL });
        const txMock = {
          adminInvitation: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ ...mockInvitation, email: TEST_EMAIL }),
            update: vi.fn().mockResolvedValue({}),
          },
          user: { create: userCreateMock },
          legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      },
    );
    const dtoWithUpperEmail = {
      ...baseAdminDto,
      email: 'NUEVO.ADMIN@FITMESS.CO',
    };

    // Act
    await service.registerAdmin(dtoWithUpperEmail, '127.0.0.1', 'test-agent');

    // Assert
    expect(userCreateMock!).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'nuevo.admin@fitmess.co' }),
      }),
    );
  });

  it('lanza BusinessException ENTITY_NOT_FOUND si el token no existe en DB (anti-enumeracion)', async () => {
    // Arrange
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
          user: { create: vi.fn() },
          legalAcceptance: { create: vi.fn() },
        };
        return fn(txMock);
      },
    );

    // Act & Assert
    await expect(
      service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent'),
    ).rejects.toMatchObject({
      errorEntry: BusinessError.ENTITY_NOT_FOUND,
    });
    expect(eventEmitterMock.emit).not.toHaveBeenCalled();
  });

  it('lanza BusinessException INVITATION_ALREADY_USED si el token ya fue utilizado', async () => {
    // Arrange
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockInvitation,
              tokenUsedAt: new Date('2026-03-07'), // ya utilizado
            }),
            update: vi.fn(),
          },
          user: { create: vi.fn() },
          legalAcceptance: { create: vi.fn() },
        };
        return fn(txMock);
      },
    );

    // Act & Assert
    await expect(
      service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent'),
    ).rejects.toMatchObject({
      errorEntry: BusinessError.INVITATION_ALREADY_USED,
    });
  });

  it('lanza BusinessException INVITATION_EXPIRED si el token esta expirado', async () => {
    // Arrange
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue({
              ...mockInvitation,
              expiresAt: new Date(Date.now() - 60 * 60 * 1000), // expirado
              tokenUsedAt: null,
            }),
            update: vi.fn(),
          },
          user: { create: vi.fn() },
          legalAcceptance: { create: vi.fn() },
        };
        return fn(txMock);
      },
    );

    // Act & Assert
    await expect(
      service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent'),
    ).rejects.toMatchObject({
      errorEntry: BusinessError.INVITATION_EXPIRED,
    });
  });

  it('lanza BusinessException DUPLICATE_ENTITY con mensaje neutro ante email o ID duplicado (anti-enumeracion)', async () => {
    // Arrange
    const prismaP2002Error = Object.assign(new Error('Unique constraint'), {
      code: 'P2002',
    });
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn(),
          },
          user: { create: vi.fn().mockRejectedValue(prismaP2002Error) },
          legalAcceptance: { create: vi.fn() },
        };
        return fn(txMock);
      },
    );

    // Act & Assert
    await expect(
      service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent'),
    ).rejects.toMatchObject({
      errorEntry: BusinessError.DUPLICATE_ENTITY,
      detail: 'Estos datos ya estan registrados en la plataforma.',
    });
  });

  it('lanza TechnicalException DATABASE_ERROR ante error de DB generico (no P2002)', async () => {
    // Arrange
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn(),
          },
          user: { create: vi.fn().mockRejectedValue(new Error('DB crash')) },
          legalAcceptance: { create: vi.fn() },
        };
        return fn(txMock);
      },
    );

    // Act & Assert
    await expect(
      service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent'),
    ).rejects.toThrow(TechnicalException);
  });

  it('la password NUNCA aparece en el contexto de la excepcion TechnicalException (Ley 1273/2009)', async () => {
    // Arrange
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn(),
          },
          user: {
            create: vi.fn().mockRejectedValue(new Error('Unexpected error')),
          },
          legalAcceptance: { create: vi.fn() },
        };
        return fn(txMock);
      },
    );

    // Act
    const error = await service
      .registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent')
      .catch((e: unknown) => e);

    // Assert — la excepcion no expone la password
    if (error instanceof TechnicalException) {
      const contextStr = JSON.stringify(error.context ?? {});
      expect(contextStr).not.toContain('AdminPass789');
    }
  });

  it('el invitationToken NUNCA aparece en la respuesta exitosa (Ley 1273/2009)', async () => {
    // Arrange
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn().mockResolvedValue({}),
          },
          user: { create: vi.fn().mockResolvedValue(mockAdminUser) },
          legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      },
    );

    // Act
    const result = await service.registerAdmin(
      baseAdminDto,
      '127.0.0.1',
      'test-agent',
    );

    // Assert — la respuesta no expone token ni passwordHash
    expect(result).not.toHaveProperty('invitationToken');
    expect(result).not.toHaveProperty('tokenHash');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('la invalidacion atomica del token (tokenUsedAt) ocurre en la MISMA $transaction que crea el User', async () => {
    // Arrange
    let transactionCallCount = 0;
    let invitationUpdatedInsideTransaction = false;
    let userCreatedInsideTransaction = false;

    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: any) => Promise<unknown>) => {
        transactionCallCount++;
        const txMock = {
          adminInvitation: {
            findUnique: vi.fn().mockResolvedValue(mockInvitation),
            update: vi.fn().mockImplementation(() => {
              invitationUpdatedInsideTransaction = true;
              return Promise.resolve({});
            }),
          },
          user: {
            create: vi.fn().mockImplementation(() => {
              userCreatedInsideTransaction = true;
              return Promise.resolve(mockAdminUser);
            }),
          },
          legalAcceptance: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      },
    );

    // Act
    await service.registerAdmin(baseAdminDto, '127.0.0.1', 'test-agent');

    // Assert — ambas operaciones ocurren dentro de la misma $transaction
    expect(transactionCallCount).toBe(1);
    expect(userCreatedInsideTransaction).toBe(true);
    expect(invitationUpdatedInsideTransaction).toBe(true);
  });
});
