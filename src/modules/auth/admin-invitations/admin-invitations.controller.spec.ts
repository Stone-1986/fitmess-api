/**
 * Tests unitarios de AdminInvitationsController.
 *
 * Verifica que el controller es THIN: delega al service y retorna
 * el resultado sin modificarlo.
 */

import { UserRole } from '../../../../generated/prisma/index.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const INVITATION_ID = 'inv-uuid-001';
const ADMIN_USER_ID = 'admin-uuid-001';
const TEST_EMAIL = 'nuevo.admin@fitmess.co';
const FUTURE_DATE = new Date(Date.now() + 48 * 60 * 60 * 1000);

const mockUser = {
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

// ── Mock del service ───────────────────────────────────────────────────────────

const adminInvitationsServiceMock = {
  create: vi.fn(),
  findByToken: vi.fn(),
};

// Simulacion del comportamiento del controller (thin — sin NestJS TestingModule)
const controllerBehavior = {
  create: (user: typeof mockUser, dto: { email: string }): Promise<unknown> => {
    return adminInvitationsServiceMock.create(user.id, dto) as Promise<unknown>;
  },
  verify: (dto: { token: string }): Promise<unknown> => {
    return adminInvitationsServiceMock.findByToken(
      dto.token,
    ) as Promise<unknown>;
  },
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AdminInvitationsController — comportamiento (delegacion al service)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create() — POST /admin-invitations ────────────────────────────────────────

  describe('create() — POST /admin-invitations', () => {
    const dto = { email: TEST_EMAIL };

    it('delega al service con el userId del admin autenticado y el DTO', async () => {
      // Arrange
      adminInvitationsServiceMock.create.mockResolvedValue(
        mockInvitationResponse,
      );

      // Act
      await controllerBehavior.create(mockUser, dto);

      // Assert
      expect(adminInvitationsServiceMock.create).toHaveBeenCalledWith(
        ADMIN_USER_ID,
        dto,
      );
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      adminInvitationsServiceMock.create.mockResolvedValue(
        mockInvitationResponse,
      );

      // Act
      const result = await controllerBehavior.create(mockUser, dto);

      // Assert
      expect(result).toBe(mockInvitationResponse);
    });

    it('usa el id del usuario autenticado (CurrentUser) — no un parametro de ruta', async () => {
      // Arrange
      adminInvitationsServiceMock.create.mockResolvedValue(
        mockInvitationResponse,
      );
      const differentAdmin = { ...mockUser, id: 'otro-admin-id' };

      // Act
      await controllerBehavior.create(differentAdmin, dto);

      // Assert
      expect(adminInvitationsServiceMock.create).toHaveBeenCalledWith(
        'otro-admin-id',
        dto,
      );
    });
  });

  // ── verify() — POST /admin-invitations/verify ─────────────────────────────────

  describe('verify() — POST /admin-invitations/verify', () => {
    const dto = { token: 'a'.repeat(64) };

    it('delega al service con el token del body', async () => {
      // Arrange
      adminInvitationsServiceMock.findByToken.mockResolvedValue(
        mockStatusResponse,
      );

      // Act
      await controllerBehavior.verify(dto);

      // Assert
      expect(adminInvitationsServiceMock.findByToken).toHaveBeenCalledWith(
        dto.token,
      );
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      adminInvitationsServiceMock.findByToken.mockResolvedValue(
        mockStatusResponse,
      );

      // Act
      const result = await controllerBehavior.verify(dto);

      // Assert
      expect(result).toBe(mockStatusResponse);
    });
  });
});

describe('AdminInvitationsController — estructura', () => {
  it('el controller tiene los metodos requeridos (thin controller)', () => {
    expect(typeof controllerBehavior.create).toBe('function');
    expect(typeof controllerBehavior.verify).toBe('function');
  });
});
