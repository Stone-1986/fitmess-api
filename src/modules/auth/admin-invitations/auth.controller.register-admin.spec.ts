/**
 * Tests unitarios de AuthController.registerAdmin() — EPICA-09.
 *
 * Verifica que el controller es THIN: delega al service con los parametros
 * correctos y retorna el resultado sin modificarlo. Instancia la clase REAL
 * via @nestjs/testing y mockea unicamente AuthService.
 *
 * Historico: hasta 2026-08-05 este spec construia una replica del controller a
 * mano ("controllerBehavior"). Los tests pasaban sin ejecutar una sola linea del
 * controller real — cobertura 0%. Se reconectaron a la clase real.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../core/auth.controller.js';
import { AuthService } from '../core/auth.service.js';
import {
  IdentificationType,
  UserRole,
} from '../../../../generated/prisma/index.js';
import { RegisterAdminDto } from './dto/register-admin.dto.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const ADMIN_ID = 'admin-uuid-001';
const TEST_EMAIL = 'nuevo.admin@fitmess.co';

const mockAdminRegistrationResponse = {
  id: ADMIN_ID,
  name: 'Carlos Ramirez',
  email: TEST_EMAIL,
  role: UserRole.ADMIN,
  createdAt: new Date('2026-03-08'),
};

const baseAdminDto = {
  invitationToken: 'a'.repeat(64),
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
} as RegisterAdminDto;

// ── Mock del AuthService ───────────────────────────────────────────────────────

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
): Parameters<AuthController['registerAdmin']>[1] {
  return {
    ip,
    headers: userAgent ? { 'user-agent': userAgent } : {},
  } as unknown as Parameters<AuthController['registerAdmin']>[1];
}

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AuthController.registerAdmin() — POST /auth/admin/register', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    vi.clearAllMocks();
  });

  it('delega al service con el DTO, ip y user-agent correctos', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    await controller.registerAdmin(
      baseAdminDto,
      buildRequest('192.168.1.10', 'admin-agent'),
    );

    // Assert
    expect(authServiceMock.registerAdmin).toHaveBeenCalledWith(
      baseAdminDto,
      '192.168.1.10',
      'admin-agent',
    );
  });

  it('retorna el resultado del service sin modificarlo', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    const result = await controller.registerAdmin(
      baseAdminDto,
      buildRequest('192.168.1.10', 'admin-agent'),
    );

    // Assert
    expect(result).toBe(mockAdminRegistrationResponse);
  });

  it('usa 0.0.0.0 cuando el request no trae ip', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    await controller.registerAdmin(
      baseAdminDto,
      buildRequest(undefined, 'admin-agent'),
    );

    // Assert — la ip se persiste en LegalAcceptance (Ley 527/1999)
    expect(authServiceMock.registerAdmin).toHaveBeenCalledWith(
      baseAdminDto,
      '0.0.0.0',
      'admin-agent',
    );
  });

  it("usa 'unknown' cuando el request no trae user-agent", async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    await controller.registerAdmin(baseAdminDto, buildRequest('192.168.1.10'));

    // Assert
    expect(authServiceMock.registerAdmin).toHaveBeenCalledWith(
      baseAdminDto,
      '192.168.1.10',
      'unknown',
    );
  });

  it('no expone el invitationToken en la respuesta', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    const result = await controller.registerAdmin(
      baseAdminDto,
      buildRequest('192.168.1.10', 'admin-agent'),
    );

    // Assert — Ley 1273/2009: el token no vuelve al cliente
    expect(result).not.toHaveProperty('invitationToken');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('propaga INVITATION_EXPIRED sin atraparla', async () => {
    // Arrange — rulesCodigo: los controllers NUNCA hacen try/catch
    const error = new Error('INVITATION_EXPIRED');
    authServiceMock.registerAdmin.mockRejectedValue(error);

    // Act & Assert
    await expect(
      controller.registerAdmin(baseAdminDto, buildRequest('192.168.1.10')),
    ).rejects.toThrow(error);
  });
});
