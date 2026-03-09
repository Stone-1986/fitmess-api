import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProblemResponse } from '../common/swagger/error-responses.js';
import { AdminInvitationsService } from './admin-invitations.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthUser } from './strategies/jwt.strategy.js';
import { UserRole } from '../../../generated/prisma/index.js';
import { CreateAdminInvitationDto } from './dto/create-admin-invitation.dto.js';
import { AdminInvitationResponseDto } from './dto/admin-invitation-response.dto.js';
import { AdminInvitationStatusResponseDto } from './dto/admin-invitation-status-response.dto.js';
import { VerifyAdminInvitationDto } from './dto/verify-admin-invitation.dto.js';

/**
 * AdminInvitationsController — gestion de invitaciones de administrador (EPICA-09)
 *
 * Ruta base: /admin-invitations
 * Registrado en AuthModule (no se crea un modulo nuevo — decision arquitectonica EPICA-09).
 *
 * HU-002: POST /admin-invitations        — ADMIN autenticado
 * HU-003: POST /admin-invitations/verify  — publico (sin JWT)
 *
 * NOTA sobre guards mixtos:
 * POST /admin-invitations requiere JwtAuthGuard + RolesGuard(ADMIN) — protegido.
 * POST /admin-invitations/verify es publico — el guard JWT se levanta con IS_PUBLIC_KEY
 * a nivel de metodo, igual que otros endpoints publicos del codebase.
 * Se documenta con security: [] en @ApiOperation para Spectral.
 *
 * NOTA sobre POST para verificacion:
 * El endpoint de verificacion es POST (no GET) porque el token es un dato sensible
 * que no debe aparecer en URLs (access logs, browser history, Referer headers).
 * Patron consistente con OAuth 2.0 Token Introspection (RFC 7662).
 */
@ApiTags('admin-invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin-invitations')
export class AdminInvitationsController {
  constructor(
    private readonly adminInvitationsService: AdminInvitationsService,
  ) {}

  // ── HU-002: Crear invitacion de administrador ────────────────────────────

  /**
   * POST /admin-invitations
   *
   * Crea AdminInvitation en DB con token unico (randomBytes(32), almacenado
   * hasheado con sha256) y expiracion configurable via ADMIN_INVITE_EXPIRATION_HOURS
   * (default 48h). Verifica previamente:
   * 1. Que no exista un User con ese email
   * 2. Que no exista una AdminInvitation activa (no expirada, no utilizada) para ese email
   *    (una invitacion expirada SI puede reemplazarse — condicion no bloqueante HU-002)
   *
   * Emite admin.invitation.created con el token RAW para que el listener de
   * notifications envie el correo al invitado.
   *
   * Ley 1273/2009: token generado con CSPRNG (randomBytes), minimo 256 bits de entropia.
   * El token RAW nunca se loggea ni se expone en la respuesta HTTP.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear invitacion para nuevo administrador',
    description:
      'Crea una invitacion de administrador con token de uso unico. ' +
      'El token se genera con aleatoriedad criptografica (CSPRNG, 256 bits de entropia, Ley 1273/2009 + OWASP). ' +
      'El token RAW se envia al invitado por correo via el evento admin.invitation.created; ' +
      'nunca se expone en la respuesta HTTP ni en logs. ' +
      'Solo se permite una invitacion activa (no expirada, no utilizada) por correo; ' +
      'una invitacion expirada para el mismo correo si permite crear una nueva invitacion. ' +
      'Requiere rol ADMIN autenticado.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Invitacion creada exitosamente. El invitado recibira el enlace de registro por correo.',
    type: AdminInvitationResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion — correo invalido o campo faltante')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Administrador',
  )
  @ApiProblemResponse(
    409,
    'Ya existe un usuario con ese correo O ya existe una invitacion activa (no expirada, no utilizada) para ese correo',
  )
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAdminInvitationDto,
  ): Promise<AdminInvitationResponseDto> {
    return this.adminInvitationsService.create(user.id, dto);
  }

  // ── HU-003: Verificar estado de invitacion por token ─────────────────────

  /**
   * POST /admin-invitations/verify
   *
   * Endpoint publico — no requiere JWT.
   * El token se recibe en el body (no en URL) para evitar exposicion en access logs
   * del servidor, historial del navegador y headers Referer (Ley 1273/2009).
   * El service hashea el token RAW con sha256 y busca por tokenHash.
   * El frontend usa este endpoint para verificar el estado antes de mostrar el formulario.
   *
   * Patron consistente con OAuth 2.0 Token Introspection (RFC 7662):
   * POST para verificacion de tokens sensibles.
   *
   * Ley 1273/2009 (anti-enumeracion):
   * - 404 para tokens inexistentes Y para tokens cuyo hash no coincide (adulterados)
   * - El 422 aplica SOLO para token valido pero expirado
   * - El 409 aplica SOLO para token valido pero ya utilizado
   *
   * Solo retorna AdminInvitationStatusResponseDto (con status ACTIVE) cuando el token es valido.
   * Los estados EXPIRED y USED se retornan como errores (422 y 409 respectivamente).
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    security: [],
    summary: 'Verificar estado de una invitacion de administrador por token',
    description:
      'Endpoint publico — no requiere autenticacion JWT. ' +
      'Verifica si el token de invitacion es valido y vigente antes de mostrar el formulario de registro. ' +
      'El token se recibe en el body (no en URL) para evitar exposicion en access logs, ' +
      'historial del navegador y headers Referer (Ley 1273/2009, OWASP). ' +
      'Patron consistente con OAuth 2.0 Token Introspection (RFC 7662). ' +
      'El service hashea el token internamente (sha256) para la busqueda. ' +
      'Retorna informacion basica de la invitacion sin exponer tokenHash ni datos del admin invitante. ' +
      'Anti-enumeracion: el error 404 se retorna tanto para tokens inexistentes ' +
      'como para tokens adulterados (hash no coincide). ' +
      'ThrottlerGuard aplica automaticamente (100 req/min).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Invitacion valida y vigente (status: ACTIVE). El formulario de registro puede mostrarse.',
    type: AdminInvitationStatusResponseDto,
  })
  @ApiProblemResponse(
    400,
    'Error de validacion — token faltante o formato invalido',
  )
  @ApiProblemResponse(
    404,
    'Token de invitacion no encontrado — inexistente o adulterado (mismo error, anti-enumeracion)',
  )
  @ApiProblemResponse(
    409,
    'La invitacion ya fue utilizada para crear una cuenta de administrador',
  )
  @ApiProblemResponse(
    422,
    'La invitacion ha expirado — solicitar una nueva invitacion al administrador',
  )
  async verify(
    @Body() dto: VerifyAdminInvitationDto,
  ): Promise<AdminInvitationStatusResponseDto> {
    return this.adminInvitationsService.findByToken(dto.token);
  }
}
