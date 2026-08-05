import { Module } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { AdminInvitationCreatedListener } from './listeners/admin-invitation-created.listener.js';

/**
 * NotificationsModule — modulo transversal de notificaciones.
 *
 * Responsabilidades:
 * - EmailService: envio de correos via Resend
 * - AdminInvitationCreatedListener: reacciona al evento admin.invitation.created
 *
 * No exporta servicios — comunicacion unidireccional via eventos (@nestjs/event-emitter).
 * Los modulos de dominio emiten eventos; este modulo escucha y notifica.
 */
@Module({
  providers: [EmailService, AdminInvitationCreatedListener],
})
export class NotificationsModule {}
