/**
 * Tests unitarios de AdminInvitationCreatedListener.
 *
 * Verifica:
 * - Que llama al EmailService con los parámetros correctos del evento
 * - Que captura errores del EmailService y NO los relanza (no interrumpe el pipeline HTTP)
 * - Que el token RAW del evento NUNCA se loggea (Ley 1273/2009)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { AdminInvitationCreatedListener } from './admin-invitation-created.listener.js';
import { EmailService } from '../email.service.js';
import type { AdminInvitationCreatedEvent } from './admin-invitation-created.listener.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const INVITATION_ID = 'inv-uuid-001';
const TEST_EMAIL = 'nuevo.admin@fitmess.co';
const RAW_TOKEN = 'a'.repeat(64);
const EXPIRES_AT = new Date(Date.now() + 48 * 60 * 60 * 1000);

const mockEvent: AdminInvitationCreatedEvent = {
  invitationId: INVITATION_ID,
  email: TEST_EMAIL,
  rawToken: RAW_TOKEN,
  expiresAt: EXPIRES_AT,
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

const emailServiceMock = {
  sendAdminInvitation: vi.fn(),
};

const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('AdminInvitationCreatedListener', () => {
  let listener: AdminInvitationCreatedListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminInvitationCreatedListener,
        { provide: EmailService, useValue: emailServiceMock },
        {
          provide: getLoggerToken(AdminInvitationCreatedListener.name),
          useValue: loggerMock,
        },
      ],
    }).compile();

    listener = module.get<AdminInvitationCreatedListener>(
      AdminInvitationCreatedListener,
    );
    vi.clearAllMocks();
  });

  describe('handleAdminInvitationCreated()', () => {
    it('llama a EmailService.sendAdminInvitation con email, rawToken y expiresAt del evento', async () => {
      // Arrange
      emailServiceMock.sendAdminInvitation.mockResolvedValue(undefined);

      // Act
      await listener.handleAdminInvitationCreated(mockEvent);

      // Assert
      expect(emailServiceMock.sendAdminInvitation).toHaveBeenCalledWith(
        TEST_EMAIL,
        RAW_TOKEN,
        EXPIRES_AT,
      );
      expect(emailServiceMock.sendAdminInvitation).toHaveBeenCalledTimes(1);
    });

    it('NO relanza el error cuando EmailService lanza una excepcion — no interrumpe el pipeline HTTP', async () => {
      // Arrange
      emailServiceMock.sendAdminInvitation.mockRejectedValue(
        new Error('Email service unavailable'),
      );

      // Act & Assert — debe completarse sin lanzar
      await expect(
        listener.handleAdminInvitationCreated(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('loggea el error cuando EmailService falla — sin exponer el token RAW (Ley 1273/2009)', async () => {
      // Arrange
      emailServiceMock.sendAdminInvitation.mockRejectedValue(
        new Error('SMTP timeout'),
      );

      // Act
      await listener.handleAdminInvitationCreated(mockEvent);

      // Assert — loggea el error
      expect(loggerMock.error).toHaveBeenCalled();
      // El log incluye el invitationId para trazabilidad
      const allErrorArgs = JSON.stringify(loggerMock.error.mock.calls);
      expect(allErrorArgs).toContain(INVITATION_ID);
      // NUNCA loggea el token RAW (Ley 1273/2009)
      expect(allErrorArgs).not.toContain(RAW_TOKEN);
      // NUNCA loggea el email completo
      expect(allErrorArgs).not.toContain(TEST_EMAIL);
    });

    it('el token RAW del evento NUNCA aparece en los logs en el happy path (Ley 1273/2009)', async () => {
      // Arrange
      emailServiceMock.sendAdminInvitation.mockResolvedValue(undefined);

      // Act
      await listener.handleAdminInvitationCreated(mockEvent);

      // Assert — ninguna llamada al logger contiene el token RAW
      const allLogCalls = JSON.stringify([
        ...loggerMock.info.mock.calls,
        ...loggerMock.error.mock.calls,
        ...loggerMock.warn.mock.calls,
      ]);
      expect(allLogCalls).not.toContain(RAW_TOKEN);
    });

    it('retorna undefined cuando el envio es exitoso (void return)', async () => {
      // Arrange
      emailServiceMock.sendAdminInvitation.mockResolvedValue(undefined);

      // Act
      const result = await listener.handleAdminInvitationCreated(mockEvent);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
