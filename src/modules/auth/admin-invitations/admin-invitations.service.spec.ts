import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { AdminInvitationsService } from './admin-invitations.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../../common/exceptions/technical.exception.js';
import { CreateAdminInvitationDto } from './dto/create-admin-invitation.dto.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const INVITATION_ID = 'inv-uuid-001';
const ADMIN_USER_ID = 'admin-uuid-001';
const TEST_EMAIL = 'nuevo.admin@fitmess.co';
const FUTURE_DATE = new Date(Date.now() + 48 * 60 * 60 * 1000);
const PAST_DATE = new Date(Date.now() - 60 * 60 * 1000);

const mockInvitation = {
  id: INVITATION_ID,
  email: TEST_EMAIL,
  expiresAt: FUTURE_DATE,
  createdAt: new Date('2026-03-08'),
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
  adminInvitation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

const configServiceMock = {
  get: vi.fn().mockReturnValue(48),
};

const eventEmitterMock = {
  emit: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AdminInvitationsService', () => {
  let service: AdminInvitationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminInvitationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<AdminInvitationsService>(AdminInvitationsService);
    vi.clearAllMocks();
  });

  // ── create() ─────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto: CreateAdminInvitationDto = { email: TEST_EMAIL };

    it('crea invitacion exitosamente → emite admin.invitation.created con token RAW', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockResolvedValue(mockInvitation);

      // Act
      const result = await service.create(ADMIN_USER_ID, dto);

      // Assert
      expect(result.id).toBe(INVITATION_ID);
      expect(result.email).toBe(TEST_EMAIL);
      expect(result.expiresAt).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'admin.invitation.created',
        expect.objectContaining({
          invitationId: INVITATION_ID,
          email: TEST_EMAIL,
          rawToken: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('normaliza el email a minusculas antes de verificar y persistir', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockResolvedValue(mockInvitation);

      // Act
      await service.create(ADMIN_USER_ID, { email: 'NUEVO.ADMIN@FITMESS.CO' });

      // Assert
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'nuevo.admin@fitmess.co' } }),
      );
      expect(prismaMock.adminInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'nuevo.admin@fitmess.co' }),
        }),
      );
    });

    it('almacena tokenHash (sha256) en DB — NUNCA el token RAW', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockResolvedValue(mockInvitation);

      // Act
      await service.create(ADMIN_USER_ID, dto);

      // Assert
      const createCall = (
        prismaMock.adminInvitation.create.mock.calls[0] as [
          { data: { tokenHash: string } },
        ]
      )[0];
      // El tokenHash es el sha256 del rawToken: debe tener 64 chars hexadecimales
      expect(createCall.data.tokenHash).toHaveLength(64);
      // El token emitido en el evento debe ser diferente del hash almacenado
      const emitCall = eventEmitterMock.emit.mock.calls[0] as [
        string,
        { rawToken: string },
      ];
      const emittedRawToken = emitCall[1].rawToken;
      expect(emittedRawToken).not.toBe(createCall.data.tokenHash);
      // El hash del token emitido debe coincidir con el almacenado
      const expectedHash = createHash('sha256')
        .update(emittedRawToken)
        .digest('hex');
      expect(createCall.data.tokenHash).toBe(expectedHash);
    });

    it('el token RAW del evento NO aparece en la respuesta HTTP', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockResolvedValue(mockInvitation);

      // Act
      const result = await service.create(ADMIN_USER_ID, dto);

      // Assert — la respuesta no tiene campo token ni rawToken
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('rawToken');
      expect(result).not.toHaveProperty('tokenHash');
      expect(Object.keys(result)).toEqual([
        'id',
        'email',
        'expiresAt',
        'createdAt',
      ]);
    });

    it('lanza BusinessException DUPLICATE_ENTITY si ya existe un User con ese email', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue({ id: 'existing-user-id' });

      // Act & Assert
      await expect(service.create(ADMIN_USER_ID, dto)).rejects.toMatchObject({
        errorEntry: BusinessError.DUPLICATE_ENTITY,
      });
      expect(prismaMock.adminInvitation.create).not.toHaveBeenCalled();
    });

    it('lanza BusinessException DUPLICATE_ENTITY si ya existe una invitacion activa (no expirada, no utilizada)', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue({
        id: 'existing-inv-id',
      });

      // Act & Assert
      await expect(service.create(ADMIN_USER_ID, dto)).rejects.toMatchObject({
        errorEntry: BusinessError.DUPLICATE_ENTITY,
      });
      expect(prismaMock.adminInvitation.create).not.toHaveBeenCalled();
    });

    it('permite crear invitacion si existe una previa pero ya expirada (condicion no bloqueante)', async () => {
      // Arrange — findFirst retorna null porque la query excluye expiradas (expiresAt > now)
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockResolvedValue(mockInvitation);

      // Act
      const result = await service.create(ADMIN_USER_ID, dto);

      // Assert — la creacion procede normalmente
      expect(result.id).toBe(INVITATION_ID);
    });

    it('la expiracion se calcula usando ADMIN_INVITE_EXPIRATION_HOURS del config (default 48h)', async () => {
      // Arrange
      configServiceMock.get.mockReturnValue(24); // 24 horas
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockResolvedValue(mockInvitation);
      const beforeCreate = new Date();

      // Act
      await service.create(ADMIN_USER_ID, dto);

      // Assert — expiresAt debe estar aprox 24h en el futuro
      const createCall = (
        prismaMock.adminInvitation.create.mock.calls[0] as [
          { data: { expiresAt: Date } },
        ]
      )[0];
      const expectedExpiry = new Date(
        beforeCreate.getTime() + 24 * 60 * 60 * 1000,
      );
      // Tolerancia de 5 segundos
      expect(createCall.data.expiresAt.getTime()).toBeCloseTo(
        expectedExpiry.getTime(),
        -4,
      );
    });

    it('registra invitedBy con el ID del admin autenticado', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockResolvedValue(mockInvitation);

      // Act
      await service.create(ADMIN_USER_ID, dto);

      // Assert
      const createCall = (
        prismaMock.adminInvitation.create.mock.calls[0] as [
          { data: { invitedBy: string } },
        ]
      )[0];
      expect(createCall.data.invitedBy).toBe(ADMIN_USER_ID);
    });

    it('lanza TechnicalException DATABASE_ERROR si falla la creacion en DB', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.adminInvitation.findFirst.mockResolvedValue(null);
      prismaMock.adminInvitation.create.mockRejectedValue(
        new Error('DB connection error'),
      );

      // Act & Assert
      await expect(service.create(ADMIN_USER_ID, dto)).rejects.toThrow(
        TechnicalException,
      );
      // El evento NO debe emitirse si la DB falla
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
    });
  });

  // ── findByToken() ─────────────────────────────────────────────────────────────

  describe('findByToken()', () => {
    const RAW_TOKEN = 'a'.repeat(64);
    const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

    it('retorna AdminInvitationStatusResponseDto con status ACTIVE para token valido', async () => {
      // Arrange
      prismaMock.adminInvitation.findUnique.mockResolvedValue({
        id: INVITATION_ID,
        email: TEST_EMAIL,
        expiresAt: FUTURE_DATE,
        tokenUsedAt: null,
      });

      // Act
      const result = await service.findByToken(RAW_TOKEN);

      // Assert
      expect(result.email).toBe(TEST_EMAIL);
      expect(result.status).toBe('ACTIVE');
      expect(result.expiresAt).toBe(FUTURE_DATE);
    });

    it('busca por tokenHash (sha256 del rawToken) — nunca por el token RAW directamente', async () => {
      // Arrange
      prismaMock.adminInvitation.findUnique.mockResolvedValue({
        id: INVITATION_ID,
        email: TEST_EMAIL,
        expiresAt: FUTURE_DATE,
        tokenUsedAt: null,
      });

      // Act
      await service.findByToken(RAW_TOKEN);

      // Assert — la query usa tokenHash, no el rawToken
      expect(prismaMock.adminInvitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: TOKEN_HASH },
        }),
      );
    });

    it('lanza BusinessException ENTITY_NOT_FOUND para token inexistente (anti-enumeracion)', async () => {
      // Arrange
      prismaMock.adminInvitation.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByToken(RAW_TOKEN)).rejects.toMatchObject({
        errorEntry: BusinessError.ENTITY_NOT_FOUND,
      });
    });

    it('lanza BusinessException INVITATION_ALREADY_USED para token ya utilizado', async () => {
      // Arrange
      prismaMock.adminInvitation.findUnique.mockResolvedValue({
        id: INVITATION_ID,
        email: TEST_EMAIL,
        expiresAt: FUTURE_DATE,
        tokenUsedAt: new Date('2026-03-07'), // ya utilizado
      });

      // Act & Assert
      await expect(service.findByToken(RAW_TOKEN)).rejects.toMatchObject({
        errorEntry: BusinessError.INVITATION_ALREADY_USED,
      });
    });

    it('lanza BusinessException INVITATION_EXPIRED para token expirado', async () => {
      // Arrange
      prismaMock.adminInvitation.findUnique.mockResolvedValue({
        id: INVITATION_ID,
        email: TEST_EMAIL,
        expiresAt: PAST_DATE, // ya expirado
        tokenUsedAt: null,
      });

      // Act & Assert
      await expect(service.findByToken(RAW_TOKEN)).rejects.toMatchObject({
        errorEntry: BusinessError.INVITATION_EXPIRED,
      });
    });

    it('verifica tokenUsedAt ANTES de verificar expiracion (token ya usado tiene precedencia)', async () => {
      // Arrange — token usado Y expirado: debe lanzar INVITATION_ALREADY_USED, no INVITATION_EXPIRED
      prismaMock.adminInvitation.findUnique.mockResolvedValue({
        id: INVITATION_ID,
        email: TEST_EMAIL,
        expiresAt: PAST_DATE,
        tokenUsedAt: new Date('2026-03-06'), // usado antes de expirar
      });

      // Act
      const error = await service
        .findByToken(RAW_TOKEN)
        .catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorEntry).toEqual(
        BusinessError.INVITATION_ALREADY_USED,
      );
    });

    it('el error 404 es identico para token inexistente y adulterado (anti-enumeracion — Ley 1273/2009)', async () => {
      // Arrange — token adulterado: el hash no coincide con ninguna invitacion
      prismaMock.adminInvitation.findUnique.mockResolvedValue(null);
      const adulteratedToken = 'b'.repeat(64);

      // Act
      const error = await service
        .findByToken(adulteratedToken)
        .catch((e: unknown) => e);

      // Assert — mismo error que token inexistente
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorEntry).toEqual(
        BusinessError.ENTITY_NOT_FOUND,
      );
    });
  });

  // ── hashToken() ───────────────────────────────────────────────────────────────

  describe('hashToken()', () => {
    it('retorna el sha256 del token RAW en hex (64 caracteres)', () => {
      // Arrange
      const rawToken = 'a'.repeat(64);
      const expectedHash = createHash('sha256').update(rawToken).digest('hex');

      // Act
      const result = service.hashToken(rawToken);

      // Assert
      expect(result).toBe(expectedHash);
      expect(result).toHaveLength(64);
    });

    it('hashes distintos para tokens distintos', () => {
      // Arrange & Act
      const hash1 = service.hashToken('a'.repeat(64));
      const hash2 = service.hashToken('b'.repeat(64));

      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });
});
