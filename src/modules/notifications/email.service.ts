import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * EmailService — servicio de envio de correos electronicos via Resend.
 *
 * Responsabilidades:
 * - Enviar correo de invitacion de administrador (admin.invitation.created)
 *
 * Errores de envio se capturan y se loggean sin propagar al caller.
 * El token RAW del correo de invitacion NUNCA se loggea (Ley 1273/2009).
 */
@Injectable()
export class EmailService {
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly appBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(EmailService.name) private readonly logger: PinoLogger,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — el envio de correos esta deshabilitado',
      );
    }
    this.fromAddress = this.configService.get<string>(
      'EMAIL_FROM',
      'noreply@fitmess.co',
    );
    this.appBaseUrl = this.configService.get<string>(
      'APP_BASE_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Envia el correo de invitacion de administrador.
   *
   * El enlace de registro incluye el token RAW como parametro de la URL.
   * NUNCA se loggea el token RAW (Ley 1273/2009).
   * Si el envio falla, se loggea el error sin propagar la excepcion.
   *
   * @param to - Correo del invitado
   * @param rawToken - Token RAW de 64 caracteres hexadecimales (generado con randomBytes(32))
   * @param expiresAt - Fecha de expiracion del token
   */
  async sendAdminInvitation(
    to: string,
    rawToken: string,
    expiresAt: Date,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        { recipientDomain: to.split('@')[1] },
        'Correo de invitacion no enviado — RESEND_API_KEY no configurada',
      );
      return;
    }

    const registrationUrl = `${this.appBaseUrl}/auth/admin/register?token=${rawToken}`;
    const expirationText = expiresAt.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'short',
    });

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Invitacion para registrarte como administrador en Fitmess',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Invitacion de administrador — Fitmess</h2>
            <p>Has sido invitado a registrarte como administrador en la plataforma Fitmess.</p>
            <p>
              <a href="${registrationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Completar registro
              </a>
            </p>
            <p>
              Este enlace vence el <strong>${expirationText}</strong>.
              Si no solicitaste esta invitacion, puedes ignorar este correo.
            </p>
            <hr />
            <p style="color: #666; font-size: 12px;">
              Este correo fue generado automaticamente. No responder a este mensaje.
            </p>
          </div>
        `,
      });

      if (error) {
        this.logger.error(
          { resendError: error.name, recipientDomain: to.split('@')[1] },
          'Error al enviar correo de invitacion de administrador via Resend',
        );
      } else {
        this.logger.info(
          { recipientDomain: to.split('@')[1] },
          'Correo de invitacion de administrador enviado exitosamente',
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(
        { errorMessage: message, recipientDomain: to.split('@')[1] },
        'Excepcion al enviar correo de invitacion de administrador',
      );
    }
  }
}
