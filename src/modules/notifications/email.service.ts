import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/**
 * EmailService — servicio de envio de correos electronicos via Resend.
 *
 * Responsabilidades:
 * - Enviar correo de invitacion de administrador (admin.invitation.created)
 * - Enviar correos de EPICA-04 (subscriptions): nueva solicitud de
 *   inscripcion al entrenador, aprobacion/rechazo al atleta
 *
 * Errores de envio se capturan y se loggean sin propagar al caller.
 * El token RAW del correo de invitacion NUNCA se loggea (Ley 1273/2009).
 * Los correos de EPICA-04 llevan nombres en el CUERPO (destinatario ya
 * conocido por el remitente en su rol de coach/atleta), pero los logs de
 * este servicio, igual que en el resto del archivo, solo registran el
 * dominio del correo — nunca el nombre ni la direccion completa.
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

  /**
   * HU-012/CA-012-1: notifica al entrenador que recibio una nueva
   * solicitud de inscripcion a uno de sus planes.
   *
   * @param to - Correo del entrenador
   * @param athleteName - Nombre del atleta solicitante (solo en el cuerpo del correo, nunca en el log)
   * @param planName - Nombre del plan solicitado
   */
  async sendSubscriptionRequested(
    to: string,
    athleteName: string,
    planName: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        { recipientDomain: to.split('@')[1] },
        'Correo de nueva solicitud de inscripcion no enviado — RESEND_API_KEY no configurada',
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Nueva solicitud de inscripcion en Fitmess',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Nueva solicitud de inscripcion</h2>
            <p><strong>${athleteName}</strong> solicito inscribirse a tu plan <strong>${planName}</strong>.</p>
            <p>Ingresa a la plataforma para aprobar o rechazar la solicitud.</p>
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
          'Error al enviar correo de nueva solicitud de inscripcion via Resend',
        );
      } else {
        this.logger.info(
          { recipientDomain: to.split('@')[1] },
          'Correo de nueva solicitud de inscripcion enviado exitosamente',
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(
        { errorMessage: message, recipientDomain: to.split('@')[1] },
        'Excepcion al enviar correo de nueva solicitud de inscripcion',
      );
    }
  }

  /**
   * HU-013/CA-013-1: notifica al atleta que su solicitud de inscripcion fue
   * aprobada Y que debe aceptar el consentimiento informado del plan para
   * poder iniciar sus sesiones (CA-013-1 lo exige de forma explicita).
   *
   * @param to - Correo del atleta
   * @param planName - Nombre del plan
   */
  async sendSubscriptionApproved(to: string, planName: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        { recipientDomain: to.split('@')[1] },
        'Correo de aprobacion de inscripcion no enviado — RESEND_API_KEY no configurada',
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Tu solicitud de inscripcion fue aprobada',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Solicitud aprobada</h2>
            <p>Tu solicitud de inscripcion al plan <strong>${planName}</strong> fue aprobada.</p>
            <p>
              Antes de poder iniciar tus sesiones debes aceptar el
              <strong>consentimiento informado deportivo</strong> del plan desde la
              plataforma.
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
          'Error al enviar correo de aprobacion de inscripcion via Resend',
        );
      } else {
        this.logger.info(
          { recipientDomain: to.split('@')[1] },
          'Correo de aprobacion de inscripcion enviado exitosamente',
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(
        { errorMessage: message, recipientDomain: to.split('@')[1] },
        'Excepcion al enviar correo de aprobacion de inscripcion',
      );
    }
  }

  /**
   * HU-013/CA-013-2: notifica al atleta que su solicitud de inscripcion fue
   * rechazada Y que puede volver a solicitar inscripcion a ese u otros
   * planes (CA-013-2 lo exige de forma explicita — la suscripcion Rechazada
   * nunca bloquea un reintento, D-3).
   *
   * @param to - Correo del atleta
   * @param planName - Nombre del plan
   */
  async sendSubscriptionRejected(to: string, planName: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        { recipientDomain: to.split('@')[1] },
        'Correo de rechazo de inscripcion no enviado — RESEND_API_KEY no configurada',
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject: 'Tu solicitud de inscripcion fue rechazada',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Solicitud rechazada</h2>
            <p>Tu solicitud de inscripcion al plan <strong>${planName}</strong> fue rechazada.</p>
            <p>Puedes volver a solicitar inscripcion a este u otros planes cuando quieras.</p>
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
          'Error al enviar correo de rechazo de inscripcion via Resend',
        );
      } else {
        this.logger.info(
          { recipientDomain: to.split('@')[1] },
          'Correo de rechazo de inscripcion enviado exitosamente',
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      this.logger.error(
        { errorMessage: message, recipientDomain: to.split('@')[1] },
        'Excepcion al enviar correo de rechazo de inscripcion',
      );
    }
  }
}
