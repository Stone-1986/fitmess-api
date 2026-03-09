import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { BusinessError } from '../../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../../common/exceptions/technical.exception.js';
import { TechnicalError } from '../../common/exceptions/technical-error.enum.js';
import { CreateAdminInvitationDto } from './dto/create-admin-invitation.dto.js';
import { AdminInvitationResponseDto } from './dto/admin-invitation-response.dto.js';
import { AdminInvitationStatusResponseDto } from './dto/admin-invitation-status-response.dto.js';
import type { AdminInvitationCreatedEvent } from '../../notifications/listeners/admin-invitation-created.listener.js';

// Expiracion por defecto: 48 horas (configurable via ADMIN_INVITE_EXPIRATION_HOURS)
const DEFAULT_EXPIRATION_HOURS = 48;

/**
 * AdminInvitationsService — logica de negocio para invitaciones de administrador (EPICA-09).
 *
 * Responsabilidades:
 * - HU-002: Crear invitacion con token CSPRNG (256 bits), almacenado hasheado con sha256
 * - HU-003: Verificar estado de una invitacion por token RAW
 *
 * Logica de validacion del token centralizada aqui:
 * - El AuthService.registerAdmin() recibe el adminInvitationId ya validado
 *   (o delega la validacion llamando a resolveAndConsumeToken() dentro de la $transaction)
 *
 * Ley 1273/2009:
 * - El token RAW NUNCA se loggea
 * - Anti-enumeracion: 404 para tokens inexistentes Y adulterados (hash no coincide)
 */
@Injectable()
export class AdminInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * HU-002: Crea una AdminInvitation.
   *
   * Flujo:
   * 1. Verifica que no exista User con ese email
   * 2. Verifica que no exista AdminInvitation activa (no expirada, no utilizada)
   *    — una invitacion expirada SI puede reemplazarse con una nueva
   * 3. Genera token RAW con randomBytes(32) (256 bits de entropia, CSPRNG)
   * 4. Almacena tokenHash (sha256 del token RAW)
   * 5. Emite admin.invitation.created con el token RAW para envio de correo
   *    — el token RAW NUNCA se loggea ni se expone en la respuesta HTTP
   *
   * @param invitedByUserId - ID del admin autenticado (tomado del JWT)
   * @param dto - CreateAdminInvitationDto (solo email)
   */
  async create(
    invitedByUserId: string,
    dto: CreateAdminInvitationDto,
  ): Promise<AdminInvitationResponseDto> {
    const email = dto.email.toLowerCase();

    // Verificar que no exista un User con ese email
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new BusinessException(
        BusinessError.DUPLICATE_ENTITY,
        `Ya existe un usuario registrado con el correo '${email}'`,
        { field: 'email' },
      );
    }

    // Verificar que no exista una invitacion activa (no expirada, no utilizada)
    // Una invitacion expirada SI puede reemplazarse (condicion no bloqueante HU-002)
    const now = new Date();
    const existingActiveInvitation =
      await this.prisma.adminInvitation.findFirst({
        where: {
          email,
          tokenUsedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });

    if (existingActiveInvitation) {
      throw new BusinessException(
        BusinessError.DUPLICATE_ENTITY,
        `Ya existe una invitacion activa para el correo '${email}'. ` +
          'Espera a que expire o contacta al invitado para que complete el registro.',
        { field: 'email', conflictType: 'active_invitation' },
      );
    }

    // Generar token RAW con CSPRNG (256 bits de entropia, Ley 1273/2009 + OWASP)
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    // Calcular expiracion (configurable via ADMIN_INVITE_EXPIRATION_HOURS)
    const expirationHours = this.configService.get<number>(
      'ADMIN_INVITE_EXPIRATION_HOURS',
      DEFAULT_EXPIRATION_HOURS,
    );
    const expiresAt = new Date(
      now.getTime() + expirationHours * 60 * 60 * 1000,
    );

    let invitation: {
      id: string;
      email: string;
      expiresAt: Date;
      createdAt: Date;
    };

    try {
      invitation = await this.prisma.adminInvitation.create({
        data: {
          email,
          tokenHash,
          invitedBy: invitedByUserId,
          expiresAt,
        },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al crear la invitacion de administrador en la base de datos',
        {},
        error as Error,
      );
    }

    // Emitir evento con token RAW para que el listener de notifications envie el correo
    // El token RAW NUNCA se loggea — el listener debe garantizar esto tambien (Ley 1273/2009)
    const event: AdminInvitationCreatedEvent = {
      invitationId: invitation.id,
      email: invitation.email,
      rawToken,
      expiresAt: invitation.expiresAt,
    };
    this.eventEmitter.emit('admin.invitation.created', event);

    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  /**
   * HU-003: Verifica el estado de una invitacion por token RAW.
   *
   * Flujo:
   * 1. Hashea el token RAW con sha256 y busca por tokenHash
   * 2. Si no existe → 404 (anti-enumeracion: mismo error para inexistentes Y adulterados)
   * 3. Si existe y tokenUsedAt != null → 409 INVITATION_ALREADY_USED
   * 4. Si existe y expiresAt < now() → 422 INVITATION_EXPIRED
   * 5. Si existe y ACTIVE → retorna AdminInvitationStatusResponseDto con status ACTIVE
   *
   * Ley 1273/2009 (anti-enumeracion): el 404 no revela si un token existio.
   *
   * @param rawToken - Token RAW de 64 caracteres hexadecimales
   */
  async findByToken(
    rawToken: string,
  ): Promise<AdminInvitationStatusResponseDto> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        tokenUsedAt: true,
      },
    });

    if (!invitation) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        'Token de invitacion no encontrado',
        { entity: 'AdminInvitation' },
      );
    }

    // Token ya utilizado → 409 (antes de verificar expiracion)
    if (invitation.tokenUsedAt !== null) {
      throw new BusinessException(
        BusinessError.INVITATION_ALREADY_USED,
        'La invitacion ya fue utilizada para crear una cuenta de administrador',
        { entity: 'AdminInvitation', invitationId: invitation.id },
      );
    }

    // Token expirado → 422
    const now = new Date();
    if (invitation.expiresAt < now) {
      throw new BusinessException(
        BusinessError.INVITATION_EXPIRED,
        'La invitacion ha expirado. Solicita una nueva invitacion al administrador.',
        { entity: 'AdminInvitation', invitationId: invitation.id },
      );
    }

    return {
      email: invitation.email,
      status: 'ACTIVE',
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Valida el token RAW y retorna el ID de la invitacion para uso dentro de una $transaction.
   *
   * Usado internamente por AuthService.registerAdmin() dentro de prisma.$transaction.
   * Lanza BusinessException si el token es invalido, expirado o ya utilizado.
   *
   * El rawToken NUNCA se loggea (Ley 1273/2009).
   *
   * @param rawToken - Token RAW de 64 caracteres hexadecimales
   * @param expectedEmail - Email del usuario que se esta registrando (debe coincidir con la invitacion)
   * @returns ID de la AdminInvitation valida
   */
  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
