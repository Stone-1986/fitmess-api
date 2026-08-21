import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiProblemResponse } from '../common/swagger/error-responses.js';
import { PaginationMeta } from '../common/interceptors/response.interceptor.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/auth-user.interface.js';
import { UserRole } from '../../../generated/prisma/index.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { AcceptConsentDto } from './dto/accept-consent.dto.js';
import { SubscriptionResponseDto } from './dto/subscription-response.dto.js';
import { SubscriptionPendingSummaryResponseDto } from './dto/subscription-pending-summary-response.dto.js';

/**
 * SubscriptionsController — inscripcion de atletas a planes de entrenamiento
 * (EPICA-04).
 *
 * Ruta base: /subscriptions
 * A diferencia de PlansController/ExercisesController (rol fijo a nivel de
 * controller), este es el primer controller del proyecto con roles MIXTOS
 * por endpoint (decision D-1): el mismo recurso, Subscription, tiene
 * operaciones exclusivas de ATHLETE (solicitar, listar propias, aceptar
 * consentimiento) y otras exclusivas de COACH (listar pendientes, aprobar,
 * rechazar). Por eso JwtAuthGuard + RolesGuard se aplican a nivel de
 * controller, pero @Roles(...) se fija por METODO — RolesGuard ya resuelve
 * el metadato mas especifico via `reflector.getAllAndOverride`.
 *
 * HU-012: POST /subscriptions                  — solicitar inscripcion (ATHLETE)
 * HU-014: GET  /subscriptions                   — listar mis suscripciones (ATHLETE)
 * HU-013: GET  /subscriptions/pending            — panel de solicitudes pendientes (COACH)
 * HU-013: POST /subscriptions/:id/approve        — aprobar solicitud (COACH)
 * HU-013: POST /subscriptions/:id/reject         — rechazar solicitud (COACH)
 * HU-014: POST /subscriptions/:id/accept-consent — aceptar consentimiento informado (ATHLETE)
 *
 * El servicio asociado es SubscriptionsService (src/modules/subscriptions/subscriptions.service.ts).
 */
@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ── HU-012: Solicitud de inscripcion ──────────────────────────────────────

  /**
   * POST /subscriptions
   *
   * Crea una suscripcion en estado Pendiente para el atleta autenticado y el
   * planId del body (CA-012-1). Rechaza con PLAN_NOT_PUBLISHED (409,
   * CA-012-4) si el plan no esta efectivamente Publicado
   * (isPlanCurrentlyPublished(), D-2/D-10), y con SUBSCRIPTION_ALREADY_EXISTS
   * (409, CA-012-2) si ya existe una suscripcion propia a ese plan en estado
   * Pendiente, Aprobada o Activa — una Rechazada previa NO bloquea
   * (CA-012-3). Emite subscription.requested.
   */
  @Post()
  @Roles(UserRole.ATHLETE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Solicitar inscripcion a un plan de entrenamiento',
    description:
      'Crea una suscripcion en estado Pendiente para el atleta autenticado y el planId ' +
      'del body (CA-012-1). Rechaza con PLAN_NOT_PUBLISHED (409) si el plan no esta ' +
      'efectivamente Publicado — un plan con status persistido PUBLISHED pero endDate ' +
      'vencida cuenta como no-publicable (CA-012-4, D-2/D-10). Rechaza con ' +
      'SUBSCRIPTION_ALREADY_EXISTS (409) si ya existe una suscripcion propia a ese plan ' +
      'en estado Pendiente, Aprobada o Activa; una suscripcion Rechazada previa NO ' +
      'bloquea el reintento (CA-012-3, nueva fila). Emite subscription.requested. Solo ' +
      'accesible para ATHLETE.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Suscripcion creada exitosamente en estado Pendiente',
    type: SubscriptionResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos de la solicitud (planId invalido)')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Atleta')
  @ApiProblemResponse(404, 'El plan referenciado por planId no existe')
  @ApiProblemResponse(
    409,
    'Ya existe una suscripcion propia en estado Pendiente, Aprobada o Activa para este ' +
      'plan (SUBSCRIPTION_ALREADY_EXISTS, CA-012-2), o el plan no acepta nuevas ' +
      'inscripciones en su estado actual (PLAN_NOT_PUBLISHED, CA-012-4)',
  )
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.create(user.id, dto);
  }

  // ── HU-014: Listado propio ────────────────────────────────────────────────

  /**
   * GET /subscriptions
   *
   * Lista TODAS las suscripciones propias del atleta autenticado, en
   * cualquier estado, paginado (CA-014-1, CA-014-4). No incluye el contenido
   * del documento de consentimiento (D-8).
   */
  @Get()
  @Roles(UserRole.ATHLETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar las suscripciones propias del atleta autenticado',
    description:
      'Lista todas las suscripciones del atleta autenticado, en cualquier estado, ' +
      'paginado — sin filtro server-side por estado (mismo criterio D-8 de EPICA-03 ' +
      'aplicado a GET /plans). Cubre CA-014-1 (ver el consentimiento pendiente en el ' +
      'cliente sobre status=Aprobada) y CA-014-4 (un item independiente por cada plan, ' +
      'incluso de entrenadores distintos). No incluye el contenido del documento de ' +
      'consentimiento (D-8). Solo accesible para ATHLETE.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numero de pagina (base 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad de resultados por pagina (max 100)',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de las suscripciones propias del atleta',
    type: SubscriptionResponseDto,
    isArray: true,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Atleta')
  async findMine(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: SubscriptionResponseDto[]; meta: PaginationMeta }> {
    return this.subscriptionsService.findMine(user.id, page, limit);
  }

  // ── HU-013: Panel de pendientes ───────────────────────────────────────────

  /**
   * GET /subscriptions/pending
   *
   * Panel de solicitudes pendientes del entrenador autenticado (CA-013-3):
   * lista, paginada, las suscripciones Pendientes de TODOS los planes
   * propios del coach. Cada item incluye el nombre del atleta y el nombre
   * del plan.
   */
  @Get('pending')
  @Roles(UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar las solicitudes pendientes de los planes del entrenador',
    description:
      'Lista, paginada, las suscripciones en estado Pendiente de TODOS los planes ' +
      'propios del entrenador autenticado (CA-013-3), filtrando por relacion ' +
      '(plan.coachId = coach autenticado). Cada item incluye el nombre del atleta y el ' +
      'nombre del plan (join de solo lectura via PrismaService, D-2). Ruta separada de ' +
      'GET /subscriptions porque la forma de la respuesta es distinta (resumen ' +
      'enriquecido vs SubscriptionResponseDto propio del atleta). Solo accesible para COACH.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numero de pagina (base 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Cantidad de resultados por pagina (max 100)',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de solicitudes pendientes sobre planes propios',
    type: SubscriptionPendingSummaryResponseDto,
    isArray: true,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Entrenador')
  async findPending(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: SubscriptionPendingSummaryResponseDto[]; meta: PaginationMeta }> {
    return this.subscriptionsService.findPending(user.id, page, limit);
  }

  // ── HU-013: Aprobacion / rechazo ──────────────────────────────────────────

  /**
   * POST /subscriptions/:id/approve
   *
   * Pendiente -> Aprobada (CA-013-1). Verifica que el plan de la suscripcion
   * pertenece al entrenador autenticado (RESOURCE_OWNERSHIP_DENIED si no,
   * CA-013-4); rechaza con INVALID_STATE_TRANSITION (409) si status !==
   * PENDING (CA-013-6). NO verifica vigencia del plan — a diferencia de
   * accept-consent (D-10). Emite subscription.approved.
   */
  @Post(':id/approve')
  @Roles(UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar una solicitud de inscripcion (Pendiente -> Aprobada)',
    description:
      'Transiciona la suscripcion de Pendiente a Aprobada (CA-013-1). Verifica que el ' +
      'plan referenciado pertenece al entrenador autenticado, si no rechaza con ' +
      'RESOURCE_OWNERSHIP_DENIED (403, CA-013-4). Rechaza con INVALID_STATE_TRANSITION ' +
      '(409) si la suscripcion ya no esta Pendiente — ya fue resuelta (CA-013-6). ' +
      'Persiste reviewedAt y el entrenador que revisa. NO verifica la vigencia del plan ' +
      '— esa verificacion ocurre en accept-consent, no aqui (D-10). Emite ' +
      'subscription.approved. Solo accesible para COACH.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solicitud aprobada exitosamente',
    type: SubscriptionResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Entrenador, o el plan de la suscripcion no ' +
      'pertenece al entrenador autenticado (RESOURCE_OWNERSHIP_DENIED, CA-013-4)',
  )
  @ApiProblemResponse(404, 'Suscripcion no encontrada')
  @ApiProblemResponse(
    409,
    'La suscripcion no esta en estado Pendiente — ya fue resuelta previamente (CA-013-6)',
  )
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.approve(user.id, id);
  }

  /**
   * POST /subscriptions/:id/reject
   *
   * Pendiente -> Rechazada (CA-013-2). Mismo mecanismo de ownership y de
   * estado que approve. Sin motivo de rechazo en el body (D-4). La
   * suscripcion Rechazada NUNCA se elimina y queda disponible para que el
   * atleta vuelva a solicitar el mismo plan (CA-012-3). Emite
   * subscription.rejected.
   */
  @Post(':id/reject')
  @Roles(UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar una solicitud de inscripcion (Pendiente -> Rechazada)',
    description:
      'Transiciona la suscripcion de Pendiente a Rechazada (CA-013-2). Mismo mecanismo ' +
      'de ownership (RESOURCE_OWNERSHIP_DENIED, CA-013-4) y de estado ' +
      '(INVALID_STATE_TRANSITION si status !== PENDING) que approve. Sin motivo de ' +
      'rechazo en el body — ninguna CA de esta epica lo exige (D-4). La suscripcion ' +
      'Rechazada NUNCA se elimina y queda disponible para que el atleta vuelva a ' +
      'solicitar el mismo plan (CA-012-3). Emite subscription.rejected. Solo accesible ' +
      'para COACH.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Solicitud rechazada exitosamente',
    type: SubscriptionResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Entrenador, o el plan de la suscripcion no ' +
      'pertenece al entrenador autenticado (RESOURCE_OWNERSHIP_DENIED, CA-013-4)',
  )
  @ApiProblemResponse(404, 'Suscripcion no encontrada')
  @ApiProblemResponse(
    409,
    'La suscripcion no esta en estado Pendiente — ya fue resuelta previamente (CA-013-6)',
  )
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.reject(user.id, id);
  }

  // ── HU-014: Consentimiento informado deportivo ────────────────────────────

  /**
   * POST /subscriptions/:id/accept-consent
   *
   * Aprobada -> Activa (CA-014-2). Verifica titularidad
   * (RESOURCE_OWNERSHIP_DENIED si no, CA-014-6); rechaza con
   * INVALID_STATE_TRANSITION (409) si status !== APPROVED. Si status ===
   * APPROVED pero el plan referenciado ya no esta efectivamente vigente
   * (CA-014-8: archivado, o su endDate ya paso), rechaza con
   * PLAN_NOT_PUBLISHED (409) SIN escribir nada — la suscripcion permanece en
   * Aprobada (D-10). Si ambos checks pasan, crea LegalAcceptance
   * (documentType=SPORT_CONSENT) y actualiza la suscripcion a Activa en una
   * unica $transaction. Emite subscription.activated.
   */
  @Post(':id/accept-consent')
  @Roles(UserRole.ATHLETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aceptar el consentimiento informado deportivo (Aprobada -> Activa)',
    description:
      'Transiciona la suscripcion de Aprobada a Activa (CA-014-2). Verifica que la ' +
      'suscripcion pertenece al atleta autenticado, si no rechaza con ' +
      'RESOURCE_OWNERSHIP_DENIED (403, CA-014-6). Rechaza con INVALID_STATE_TRANSITION ' +
      '(409) si status !== APPROVED. Si status === APPROVED pero el plan referenciado ya ' +
      'no esta efectivamente vigente (esta Archivado, o su endDate ya paso aunque la ' +
      'columna status siga en PUBLISHED — CA-014-8, D-10), rechaza con ' +
      'PLAN_NOT_PUBLISHED (409) SIN escribir nada: la suscripcion permanece en Aprobada, ' +
      'ninguna transaccion se abre. Si ambos checks de estado pasan, crea un ' +
      'LegalAcceptance (documentType=SPORT_CONSENT, documentVersion del body, ip, ' +
      'userAgent) y actualiza la suscripcion a Activa en una unica transaccion atomica. ' +
      'Emite subscription.activated. Solo accesible para ATHLETE.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Consentimiento aceptado exitosamente — suscripcion activada',
    type: SubscriptionResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos del consentimiento')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Atleta, o la suscripcion no pertenece al ' +
      'atleta autenticado (RESOURCE_OWNERSHIP_DENIED, CA-014-6)',
  )
  @ApiProblemResponse(404, 'Suscripcion no encontrada')
  @ApiProblemResponse(
    409,
    'La suscripcion no esta en estado Aprobada — ya fue resuelta o activada ' +
      '(INVALID_STATE_TRANSITION), o el plan referenciado ya no esta efectivamente ' +
      'vigente y la suscripcion permanece en Aprobada sin activarse (PLAN_NOT_PUBLISHED, CA-014-8)',
  )
  async acceptConsent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptConsentDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.acceptConsent(user.id, id, dto);
  }
}
