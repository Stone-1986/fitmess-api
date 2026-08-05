import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EmailService } from '../email.service.js';

/**
 * Evento emitido por AdminInvitationsService al crear una invitacion.
 * El token RAW se incluye para que el listener pueda construir el enlace de registro.
 * NUNCA se loggea el rawToken (Ley 1273/2009).
 */
export interface AdminInvitationCreatedEvent {
  invitationId: string;
  email: string;
  rawToken: string;
  expiresAt: Date;
}

/**
 * AdminInvitationCreatedListener — listener del evento admin.invitation.created.
 *
 * Responsabilidad: construir y enviar el correo de invitacion al invitado.
 * Los errores de envio se capturan en try/catch sin propagar al pipeline HTTP.
 * El token RAW del evento NUNCA se loggea (Ley 1273/2009).
 *
 * Decision arquitectonica EPICA-09: comunicacion entre modulos via eventos.
 * AdminInvitationsService (auth) emite; este listener (notifications) escucha.
 */
@Injectable()
export class AdminInvitationCreatedListener {
  constructor(
    private readonly emailService: EmailService,
    @InjectPinoLogger(AdminInvitationCreatedListener.name)
    private readonly logger: PinoLogger,
  ) {}

  @OnEvent('admin.invitation.created')
  async handleAdminInvitationCreated(
    event: AdminInvitationCreatedEvent,
  ): Promise<void> {
    try {
      // El rawToken se pasa al EmailService que lo incluye en el enlace.
      // NUNCA se loggea el rawToken ni el email completo (Ley 1273/2009).
      await this.emailService.sendAdminInvitation(
        event.email,
        event.rawToken,
        event.expiresAt,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      // Log solo el ID de la invitacion — nunca el email ni el token (Ley 1273/2009)
      this.logger.error(
        { invitationId: event.invitationId, errorMessage: message },
        'Error en listener admin.invitation.created — el correo no fue enviado',
      );
      // No relanzar — los listeners no propagan excepciones al pipeline HTTP
    }
  }
}
