/**
 * Tests unitarios de EmailService.
 *
 * Verifica:
 * - Que sendAdminInvitation construye el enlace con el token RAW y llama a Resend
 * - Que los errores de Resend se capturan internamente (no se propagan)
 * - Que el token RAW nunca se loggea (Ley 1273/2009)
 *
 * NOTA DE INFRAESTRUCTURA:
 * EmailService instancia Resend con `new Resend(apiKey)` en el constructor.
 * Para testear el service sin llamadas de red reales, se crea una instancia
 * directamente (sin TestingModule) y se espía sobre el cliente Resend interno
 * usando vi.spyOn después de la creación.
 */

import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const configServiceMock = {
  get: (key: string, defaultValue?: string): string => {
    const config: Record<string, string> = {
      RESEND_API_KEY: 'test-api-key',
      EMAIL_FROM: 'noreply@fitmess.co',
      APP_BASE_URL: 'http://localhost:3000',
    };
    return config[key] ?? defaultValue ?? '';
  },
} as unknown as ConfigService;

const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('EmailService', () => {
  let service: EmailService;
  let resendSendSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Crear instancia directamente — ConfigService y logger se inyectan via constructor
    service = new EmailService(configServiceMock, loggerMock as never);

    // Espiar el método send del cliente Resend instanciado internamente
    resendSendSpy = vi.fn().mockResolvedValue({ error: null }) as ReturnType<
      typeof vi.fn
    >;
    // Acceder al cliente privado via cast para el spy
    (
      service as unknown as { resend: { emails: { send: unknown } } }
    ).resend.emails.send = resendSendSpy;

    vi.clearAllMocks();
    // Restaurar el spy después de clearAllMocks
    (
      service as unknown as { resend: { emails: { send: unknown } } }
    ).resend.emails.send = resendSendSpy;
  });

  // ── sendAdminInvitation() ─────────────────────────────────────────────────────

  describe('sendAdminInvitation()', () => {
    const TO = 'nuevo.admin@fitmess.co';
    const RAW_TOKEN = 'a'.repeat(64);
    const EXPIRES_AT = new Date(Date.now() + 48 * 60 * 60 * 1000);

    it('envía correo a la dirección correcta con enlace que incluye el token RAW', async () => {
      // Arrange
      resendSendSpy.mockResolvedValue({ error: null });

      // Act
      await service.sendAdminInvitation(TO, RAW_TOKEN, EXPIRES_AT);

      // Assert
      expect(resendSendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: TO,
          subject: expect.stringContaining('Invitacion'),
          html: expect.stringContaining(RAW_TOKEN),
        }),
      );
    });

    it('el enlace de registro incluye la ruta /auth/admin/register con el token', async () => {
      // Arrange
      resendSendSpy.mockResolvedValue({ error: null });

      // Act
      await service.sendAdminInvitation(TO, RAW_TOKEN, EXPIRES_AT);

      // Assert
      const callArg = resendSendSpy.mock.calls[0] as [{ html: string }];
      expect(callArg[0].html).toContain('/auth/admin/register');
      expect(callArg[0].html).toContain(RAW_TOKEN);
    });

    it('NO lanza excepcion cuando Resend retorna error (captura internamente)', async () => {
      // Arrange
      resendSendSpy.mockResolvedValue({
        error: { name: 'validation_error', message: 'Invalid email' },
      });

      // Act & Assert — no debe lanzar
      await expect(
        service.sendAdminInvitation(TO, RAW_TOKEN, EXPIRES_AT),
      ).resolves.toBeUndefined();
    });

    it('NO lanza excepcion cuando Resend lanza una excepcion de red (captura en catch)', async () => {
      // Arrange
      resendSendSpy.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert — no debe lanzar
      await expect(
        service.sendAdminInvitation(TO, RAW_TOKEN, EXPIRES_AT),
      ).resolves.toBeUndefined();
    });

    it('loggea el error cuando Resend retorna error — sin exponer el token RAW (Ley 1273/2009)', async () => {
      // Arrange
      resendSendSpy.mockResolvedValue({
        error: { name: 'rate_limit', message: 'Too many requests' },
      });

      // Act
      await service.sendAdminInvitation(TO, RAW_TOKEN, EXPIRES_AT);

      // Assert — loggea el error pero NO el token RAW
      expect(loggerMock.error).toHaveBeenCalled();
      const allErrorArgs = JSON.stringify(loggerMock.error.mock.calls);
      // No debe contener el token RAW
      expect(allErrorArgs).not.toContain(RAW_TOKEN);
      // No debe contener el email completo
      expect(allErrorArgs).not.toContain(TO);
    });

    it('loggea la excepcion de red sin exponer el token RAW (Ley 1273/2009)', async () => {
      // Arrange
      resendSendSpy.mockRejectedValue(new Error('Connection refused'));

      // Act
      await service.sendAdminInvitation(TO, RAW_TOKEN, EXPIRES_AT);

      // Assert — loggea excepcion pero no el token
      expect(loggerMock.error).toHaveBeenCalled();
      const allErrorArgs = JSON.stringify(loggerMock.error.mock.calls);
      expect(allErrorArgs).not.toContain(RAW_TOKEN);
    });

    it('usa el remitente configurado en EMAIL_FROM', async () => {
      // Arrange
      resendSendSpy.mockResolvedValue({ error: null });

      // Act
      await service.sendAdminInvitation(TO, RAW_TOKEN, EXPIRES_AT);

      // Assert
      const callArg = resendSendSpy.mock.calls[0] as [{ from: string }];
      expect(callArg[0].from).toBe('noreply@fitmess.co');
    });
  });

  // ── Sin RESEND_API_KEY ───────────────────────────────────────────────────────
  //
  // Es el estado real de los entornos de desarrollo y de CI: el .env no trae la
  // clave. Esta rama estaba sin cubrir (hallazgo #2b) pese a ser la que corre en
  // cada arranque local — se ve el warn en la salida de todos los tests e2e.

  describe('sin RESEND_API_KEY configurada', () => {
    const configSinClave = {
      get: (key: string, defaultValue?: string): string => {
        const config: Record<string, string> = {
          EMAIL_FROM: 'noreply@fitmess.co',
          APP_BASE_URL: 'http://localhost:3000',
        };
        return config[key] ?? defaultValue ?? '';
      },
    } as unknown as ConfigService;

    it('advierte al construirse que el envío queda deshabilitado', () => {
      const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

      new EmailService(configSinClave, logger as never);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('RESEND_API_KEY'),
      );
    });

    it('NO intenta enviar el correo y retorna sin lanzar', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
      const sinClave = new EmailService(configSinClave, logger as never);

      // No debe reventar: la ausencia de la clave deshabilita el envío, no
      // rompe el registro del administrador que dispara el evento.
      await expect(
        sinClave.sendAdminInvitation(
          'invitado@fitmess.co',
          'token-raw',
          new Date('2026-12-31'),
        ),
      ).resolves.toBeUndefined();
    });

    it('al no enviar, loggea solo el dominio del destinatario — nunca el correo completo (Ley 1581/2012)', async () => {
      const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
      const sinClave = new EmailService(configSinClave, logger as never);
      logger.warn.mockClear();

      await sinClave.sendAdminInvitation(
        'invitado@fitmess.co',
        'token-raw-secreto',
        new Date('2026-12-31'),
      );

      const serializado = JSON.stringify(logger.warn.mock.calls);
      expect(serializado).toContain('fitmess.co');
      expect(serializado).not.toContain('invitado@fitmess.co');
      expect(serializado).not.toContain('token-raw-secreto');
    });
  });
});
