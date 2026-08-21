import { Module } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { AdminInvitationCreatedListener } from './listeners/admin-invitation-created.listener.js';
import { SubscriptionRequestedListener } from './listeners/subscription-requested.listener.js';
import { SubscriptionApprovedListener } from './listeners/subscription-approved.listener.js';
import { SubscriptionRejectedListener } from './listeners/subscription-rejected.listener.js';

/**
 * NotificationsModule — modulo transversal de notificaciones.
 *
 * Responsabilidades:
 * - EmailService: envio de correos via Resend
 * - AdminInvitationCreatedListener: reacciona al evento admin.invitation.created
 * - SubscriptionRequestedListener/SubscriptionApprovedListener/
 *   SubscriptionRejectedListener (EPICA-04): reaccionan a
 *   subscription.requested/approved/rejected. subscription.activated NO
 *   tiene listener aqui a proposito — D-7, punto de integracion de EPICA-05.
 *
 * No exporta servicios — comunicacion unidireccional via eventos (@nestjs/event-emitter).
 * Los modulos de dominio emiten eventos; este modulo escucha y notifica.
 * Los listeners de subscriptions resuelven email/nombre via PrismaService
 * (compartido, @Global) a partir de los IDs del evento — nunca importan
 * SubscriptionsService ni SubscriptionsModule.
 */
@Module({
  providers: [
    EmailService,
    AdminInvitationCreatedListener,
    SubscriptionRequestedListener,
    SubscriptionApprovedListener,
    SubscriptionRejectedListener,
  ],
})
export class NotificationsModule {}
