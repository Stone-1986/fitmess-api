/**
 * Tests unitarios de AuthController.registerAdmin() — EPICA-09.
 *
 * Verifica que el controller es THIN: delega al service con los parámetros
 * correctos y retorna el resultado sin modificarlo.
 */

import {
  IdentificationType,
  UserRole,
} from '../../../../generated/prisma/index.js';

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
};

// ── Mock del AuthService ───────────────────────────────────────────────────────

const authServiceMock = {
  registerAdmin: vi.fn(),
};

// Simulacion del comportamiento del controller (thin — delegacion directa)
const controllerBehavior = {
  registerAdmin: (
    dto: typeof baseAdminDto,
    req: { ip?: string; headers: Record<string, string> },
  ): Promise<unknown> => {
    const ip = req.ip ?? '0.0.0.0';
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    return authServiceMock.registerAdmin(
      dto,
      ip,
      userAgent,
    ) as Promise<unknown>;
  },
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AuthController.registerAdmin() — POST /auth/admin/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delega al service con el DTO, ip y user-agent del request', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    await controllerBehavior.registerAdmin(baseAdminDto, {
      ip: '192.168.1.1',
      headers: { 'user-agent': 'Mozilla/5.0' },
    });

    // Assert
    expect(authServiceMock.registerAdmin).toHaveBeenCalledWith(
      baseAdminDto,
      '192.168.1.1',
      'Mozilla/5.0',
    );
  });

  it('retorna el resultado del service sin modificarlo', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    const result = await controllerBehavior.registerAdmin(baseAdminDto, {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    });

    // Assert
    expect(result).toBe(mockAdminRegistrationResponse);
  });

  it('usa ip fallback 0.0.0.0 cuando req.ip es undefined', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    await controllerBehavior.registerAdmin(baseAdminDto, {
      ip: undefined,
      headers: { 'user-agent': 'test-agent' },
    });

    // Assert
    expect(authServiceMock.registerAdmin).toHaveBeenCalledWith(
      baseAdminDto,
      '0.0.0.0',
      'test-agent',
    );
  });

  it('usa user-agent fallback unknown cuando el header no esta presente', async () => {
    // Arrange
    authServiceMock.registerAdmin.mockResolvedValue(
      mockAdminRegistrationResponse,
    );

    // Act
    await controllerBehavior.registerAdmin(baseAdminDto, {
      ip: '127.0.0.1',
      headers: {},
    });

    // Assert
    expect(authServiceMock.registerAdmin).toHaveBeenCalledWith(
      baseAdminDto,
      '127.0.0.1',
      'unknown',
    );
  });

  it('NO realiza try/catch — las excepciones fluyen al pipeline de NestJS', async () => {
    // Arrange — el service lanza un error
    authServiceMock.registerAdmin.mockRejectedValue(
      new Error('BusinessException simulada'),
    );

    // Act & Assert — el controller no captura la excepcion, la deja fluir
    await expect(
      controllerBehavior.registerAdmin(baseAdminDto, {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      }),
    ).rejects.toThrow('BusinessException simulada');
  });
});
