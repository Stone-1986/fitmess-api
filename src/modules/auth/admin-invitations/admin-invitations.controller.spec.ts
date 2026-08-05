/**
 * Tests unitarios de AdminInvitationsController.
 *
 * Verifica que el controller es THIN: delega al service y retorna el resultado
 * sin modificarlo. Instancia la clase REAL via @nestjs/testing y mockea
 * unicamente AdminInvitationsService.
 *
 * Historico: hasta 2026-08-05 este spec construia una replica del controller a
 * mano ("controllerBehavior"). Los tests pasaban sin ejecutar una sola linea del
 * controller real — cobertura 0%. Se reconectaron a la clase real.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminInvitationsController } from './admin-invitations.controller.js';
import { AdminInvitationsService } from './admin-invitations.service.js';
import { UserRole } from '../../../../generated/prisma/index.js';
import { CreateAdminInvitationDto } from './dto/create-admin-invitation.dto.js';
import { VerifyAdminInvitationDto } from './dto/verify-admin-invitation.dto.js';
import { AuthUser } from '../shared/strategies/jwt.strategy.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const INVITATION_ID = 'inv-uuid-001';
const ADMIN_USER_ID = 'admin-uuid-001';
const TEST_EMAIL = 'nuevo.admin@fitmess.co';
const RAW_TOKEN = 'a'.repeat(64);
const FUTURE_DATE = new Date(Date.now() + 48 * 60 * 60 * 1000);

const mockUser: AuthUser = {
  id: ADMIN_USER_ID,
  email: 'admin@fitmess.co',
  role: UserRole.ADMIN,
};

const mockInvitationResponse = {
  id: INVITATION_ID,
  email: TEST_EMAIL,
  expiresAt: FUTURE_DATE,
  createdAt: new Date('2026-03-08'),
};

const mockStatusResponse = {
  email: TEST_EMAIL,
  status: 'ACTIVE' as const,
  expiresAt: FUTURE_DATE,
};

const createDto = { email: TEST_EMAIL } as CreateAdminInvitationDto;
const verifyDto = { token: RAW_TOKEN } as VerifyAdminInvitationDto;

// ── Mock del service ───────────────────────────────────────────────────────────

const adminInvitationsServiceMock = {
  create: vi.fn(),
  findByToken: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AdminInvitationsController', () => {
  let controller: AdminInvitationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminInvitationsController],
      providers: [
        {
          provide: AdminInvitationsService,
          useValue: adminInvitationsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminInvitationsController>(
      AdminInvitationsController,
    );
    vi.clearAllMocks();
  });

  it('se instancia correctamente', () => {
    expect(controller).toBeInstanceOf(AdminInvitationsController);
  });

  // ── create() ─────────────────────────────────────────────────────────────────

  describe('create() — POST /admin-invitations', () => {
    it('delega al service con el id del admin autenticado y el DTO', async () => {
      // Arrange
      adminInvitationsServiceMock.create.mockResolvedValue(
        mockInvitationResponse,
      );

      // Act
      await controller.create(mockUser, createDto);

      // Assert — pasa user.id, no el objeto completo
      expect(adminInvitationsServiceMock.create).toHaveBeenCalledWith(
        ADMIN_USER_ID,
        createDto,
      );
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      adminInvitationsServiceMock.create.mockResolvedValue(
        mockInvitationResponse,
      );

      // Act
      const result = await controller.create(mockUser, createDto);

      // Assert
      expect(result).toBe(mockInvitationResponse);
    });

    it('no expone el token en la respuesta — solo llega por email', async () => {
      // Arrange
      adminInvitationsServiceMock.create.mockResolvedValue(
        mockInvitationResponse,
      );

      // Act
      const result = await controller.create(mockUser, createDto);

      // Assert — Ley 1273/2009: el token viaja solo por el canal de email
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('tokenHash');
    });

    it('propaga la excepcion del service sin atraparla', async () => {
      // Arrange
      const error = new Error('DUPLICATE_ENTITY');
      adminInvitationsServiceMock.create.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.create(mockUser, createDto)).rejects.toThrow(
        error,
      );
    });
  });

  // ── verify() ─────────────────────────────────────────────────────────────────

  describe('verify() — POST /admin-invitations/verify', () => {
    it('delega al service pasando solo el token del body', async () => {
      // Arrange
      adminInvitationsServiceMock.findByToken.mockResolvedValue(
        mockStatusResponse,
      );

      // Act
      await controller.verify(verifyDto);

      // Assert — el token va en el body, nunca en la URL (evita access logs)
      expect(adminInvitationsServiceMock.findByToken).toHaveBeenCalledWith(
        RAW_TOKEN,
      );
    });

    it('retorna el estado del service sin modificarlo', async () => {
      // Arrange
      adminInvitationsServiceMock.findByToken.mockResolvedValue(
        mockStatusResponse,
      );

      // Act
      const result = await controller.verify(verifyDto);

      // Assert
      expect(result).toBe(mockStatusResponse);
    });

    it('propaga INVITATION_EXPIRED sin atraparla', async () => {
      // Arrange
      const error = new Error('INVITATION_EXPIRED');
      adminInvitationsServiceMock.findByToken.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.verify(verifyDto)).rejects.toThrow(error);
    });
  });

  // ── Contrato de controller THIN ──────────────────────────────────────────────

  describe('contrato THIN', () => {
    it('expone exactamente los 2 metodos del contrato', () => {
      const metodos = Object.getOwnPropertyNames(
        AdminInvitationsController.prototype,
      ).filter((m) => m !== 'constructor');

      expect(metodos.sort()).toEqual(['create', 'verify']);
    });
  });
});
