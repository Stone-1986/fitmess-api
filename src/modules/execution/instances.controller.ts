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
import { InstancesService } from './instances.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/auth-user.interface.js';
import { UserRole } from '../../../generated/prisma/index.js';
import { RegisterSessionResultDto } from './dto/register-session-result.dto.js';
import { RegisterWeeklyFeelingDto } from './dto/register-weekly-feeling.dto.js';
import { InstanceSummaryResponseDto } from './dto/instance-summary-response.dto.js';
import { InstanceDetailResponseDto } from './dto/instance-detail-response.dto.js';
import { SessionResultResponseDto } from './dto/session-result-response.dto.js';
import { WeeklyFeelingResponseDto } from './dto/weekly-feeling-response.dto.js';

/**
 * InstancesController — ejecucion de la instancia personalizada del plan
 * (EPICA-05, modulo nuevo `execution`).
 *
 * Ruta base: /instances (top-level, NUNCA anidado bajo /plans — D-7, mismo
 * invariante ya establecido por D-10 de EPICA-03 entre PlansController y
 * PlansCatalogController: cada controller tiene su propio prefijo unico).
 *
 * El parametro de ruta en todos los endpoints es `:planId` — el id de la
 * PLANTILLA, nunca el id interno de PlanInstance (D-7b): el atleta y el
 * entrenador razonan en terminos de "la instancia del plan X", nunca
 * conocen ni necesitan ese id interno.
 *
 * Roles MIXTOS por endpoint (mismo patron D-1 de SubscriptionsController,
 * EPICA-04): JwtAuthGuard + RolesGuard a nivel de controller, @Roles(...)
 * por metodo.
 *
 * GET  /instances                              — ATHLETE — HU-023, listar mis instancias
 * GET  /instances/:planId                       — ATHLETE — HU-023, detalle propio (auto-reparable, D-3)
 * GET  /instances/:planId/athletes/:athleteId    — COACH   — HU-017 (+ lectura HU-016), panel del atleta
 * POST /instances/:planId/sessions/:sessionId/results — ATHLETE — HU-015, registrar/editar resultados (dispara HU-017)
 * POST /instances/:planId/weeks/:weekId/feelings      — ATHLETE — HU-016, registrar/editar sensaciones
 *
 * No existe ningun endpoint de creacion manual de instancia — CA-023-1 lo
 * exige explicitamente ("sin intervencion manual"). La instancia se crea
 * por SubscriptionActivatedListener (camino rapido) o, si el listener aun
 * no corrio, por el propio GET /instances/:planId (camino de
 * auto-reparacion, D-3).
 *
 * El servicio asociado es InstancesService (src/modules/execution/instances.service.ts).
 */
@ApiTags('instances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instances')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  // ── HU-023: Listado y detalle propio ──────────────────────────────────────

  /**
   * GET /instances
   *
   * Lista, paginada, todas las instancias propias del atleta autenticado
   * (CA-023-4, CA-023-5) — resumen liviano, sin el arbol completo (D-8 de
   * EPICA-03 aplicado aqui).
   */
  @Get()
  @Roles(UserRole.ATHLETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Listar las instancias personalizadas propias del atleta autenticado',
    description:
      'Lista, paginada, todas las instancias del atleta autenticado — un item por plan ' +
      'al que llego a tener una suscripcion Activa (CA-023-4, CA-023-5). Resumen liviano ' +
      '(id, planId, planName, createdAt), sin el arbol completo — mismo criterio D-8 de ' +
      'EPICA-03. planName resuelto via join de solo lectura contra Plan. Solo accesible ' +
      'para ATHLETE.',
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
    description: 'Lista paginada de las instancias propias del atleta',
    type: InstanceSummaryResponseDto,
    isArray: true,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Atleta')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: InstanceSummaryResponseDto[]; meta: PaginationMeta }> {
    return this.instancesService.findAll(user.id, page, limit);
  }

  /**
   * GET /instances/:planId
   *
   * Detalle propio con el arbol completo embebido (D-2). AUTO-REPARABLE
   * (D-3): si la suscripcion del atleta esta Activa pero la instancia
   * todavia no existe (ventana de carrera del listener), la crea sobre la
   * marcha con el mismo metodo idempotente que usa el listener — el atleta
   * nunca ve un 404 mientras su suscripcion siga Activa (CA-023-1).
   */
  @Get(':planId')
  @Roles(UserRole.ATHLETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Obtener el detalle propio de la instancia personalizada de un plan',
    description:
      'Devuelve el arbol completo de la instancia propia del atleta para el plan ' +
      ':planId: fases -> semanas (con isClosed/closedAt y sensaciones si existen) -> ' +
      'sesiones (con el resultado registrado si existe) -> ejercicios (con la version ' +
      'congelada y la prescripcion copiada de la plantilla, D-15). Verifica primero que ' +
      'el plan exista (404 si no), luego que exista una Subscription propia en estado ' +
      'Activa para ese plan (CONSENT_REQUIRED, 422, si no — CA-023-6). Si la suscripcion ' +
      'esta Activa pero la instancia todavia no existe (ventana de carrera del listener), ' +
      'la crea sobre la marcha con el mismo metodo idempotente del listener antes de ' +
      'responder — auto-reparacion (D-3): el atleta nunca ve un 404 "todavia no existe" ' +
      'mientras su suscripcion siga Activa (CA-023-1). Solo accesible para ATHLETE.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle completo de la instancia propia',
    type: InstanceDetailResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Atleta')
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(
    422,
    'Se requiere una inscripcion activa con consentimiento informado aceptado ' +
      '(CONSENT_REQUIRED, CA-023-6) — la suscripcion del atleta a este plan no esta en ' +
      'estado Activa',
  )
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
  ): Promise<InstanceDetailResponseDto> {
    return this.instancesService.findOwn(user.id, planId);
  }

  // ── HU-017: Panel del entrenador ──────────────────────────────────────────

  /**
   * GET /instances/:planId/athletes/:athleteId
   *
   * Panel del entrenador sobre la instancia de UN atleta especifico en UNO
   * de sus planes (CA-017-2, CA-017-4; tambien satisface la lectura de
   * sensaciones de CA-016-3/CA-016-6). Endpoint separado del GET del atleta
   * porque toma un parametro adicional (athleteId) que el atleta nunca
   * necesita (D-8/D-9).
   */
  @Get(':planId/athletes/:athleteId')
  @Roles(UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Obtener el panel de la instancia de un atleta para un plan propio',
    description:
      'Devuelve el mismo arbol completo que GET /instances/:planId (D-8, MISMO DTO), ' +
      'para la instancia del atleta :athleteId en el plan :planId. Verifica que :planId ' +
      'pertenece al entrenador autenticado (RESOURCE_OWNERSHIP_DENIED, 403, si no — ' +
      'CA-017-4). Si el atleta no tiene una suscripcion Activa a :planId (o el plan no ' +
      'existe), responde ENTITY_NOT_FOUND (404) — NUNCA CONSENT_REQUIRED: ese codigo es ' +
      'un mensaje dirigido al propio atleta, sin sentido de negocio para un entrenador ' +
      'que consulta a un tercero (D-9). :athleteId viaja en la URL, por eso este endpoint ' +
      'NO requiere @AuditResources (D-12) — la fila de auditoria ya identifica al titular ' +
      'consultado via la columna url. Solo accesible para COACH.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle completo de la instancia del atleta consultado',
    type: InstanceDetailResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede consultar sus ' +
      'atletas (RESOURCE_OWNERSHIP_DENIED, CA-017-4)',
  )
  @ApiProblemResponse(
    404,
    'Plan no encontrado, o el atleta no tiene una instancia en este plan (sin ' +
      'suscripcion Activa)',
  )
  async findForCoach(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('athleteId', ParseUUIDPipe) athleteId: string,
  ): Promise<InstanceDetailResponseDto> {
    return this.instancesService.findForCoach(user.id, planId, athleteId);
  }

  // ── HU-015: Registro de resultados ────────────────────────────────────────

  /**
   * POST /instances/:planId/sessions/:sessionId/results
   *
   * Registra o edita los resultados de una sesion de la instancia propia
   * (upsert — D-6b). Orden de verificacion: (1) Subscription Activa, (2)
   * ownership de la sesion, (3) conjunto exacto de ejercicios
   * (RESULT_FIELDS_INVALID si no coincide, CA-015-10), (4) semana no
   * cerrada (WEEK_FROZEN si lo esta). Si las cuatro pasan, upsert atomico
   * del resultado y de cada resultado de ejercicio (D-4/D-6); si esta era
   * la ultima sesion pendiente de su semana, la cierra y emite week.closed.
   */
  @Post(':planId/sessions/:sessionId/results')
  @Roles(UserRole.ATHLETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Registrar o editar los resultados de una sesion de la instancia propia',
    description:
      'Upsert de los resultados de la sesion :sessionId de la instancia propia del ' +
      'atleta (D-6b, un solo endpoint para alta y edicion — ningun CA distingue esos dos ' +
      'casos). Por cada ejercicio: series, repeticiones, carga, duracion, distancia (solo ' +
      'los que apliquen segun el tipo, CA-015-11) y nota libre opcional, columnas ' +
      'tipadas (CA-015-9, D-6). Orden de verificacion: (1) Subscription Activa del ' +
      'atleta para :planId, si no CONSENT_REQUIRED (422, CA-015-7); (2) la sesion ' +
      'pertenece a la instancia propia, si no ENTITY_NOT_FOUND (404) o ' +
      'RESOURCE_OWNERSHIP_DENIED (403, CA-015-6); (3) el payload trae EXACTAMENTE los ' +
      'ejercicios de esa sesion, si no RESULT_FIELDS_INVALID (422, CA-015-10) SIN escribir ' +
      'nada — la sesion no cuenta como completada; (4) la semana no esta cerrada, si lo ' +
      'esta WEEK_FROZEN (409, CA-015-4/5). Si las cuatro pasan, upserta el resultado y ' +
      'cada resultado de ejercicio en una unica transaccion; si esta era la ultima sesion ' +
      'pendiente de su semana, la cierra (isClosed=true, closedAt=now(), RN-30) y emite ' +
      'week.closed despues del commit (D-4). Editable sin limite de tiempo mientras la ' +
      'semana siga abierta (CA-015-2/3, RN-08 derogada). Solo accesible para ATHLETE.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Resultados de la sesion registrados o actualizados exitosamente',
    type: SessionResultResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos del resultado')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'La sesion pertenece a la instancia de otro atleta (RESOURCE_OWNERSHIP_DENIED, CA-015-6)',
  )
  @ApiProblemResponse(
    404,
    'Plan o sesion no encontrados en la instancia propia',
  )
  @ApiProblemResponse(
    409,
    'La semana a la que pertenece esta sesion ya cerro y sus datos son definitivos ' +
      '(WEEK_FROZEN, CA-015-4/5)',
  )
  @ApiProblemResponse(
    422,
    'Se requiere una inscripcion activa con consentimiento informado aceptado ' +
      '(CONSENT_REQUIRED, CA-015-7), o el payload no incluye exactamente los ejercicios ' +
      'programados de la sesion (RESULT_FIELDS_INVALID, CA-015-10)',
  )
  async registerSessionResult(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RegisterSessionResultDto,
  ): Promise<SessionResultResponseDto> {
    return this.instancesService.registerSessionResult(
      user.id,
      planId,
      sessionId,
      dto,
    );
  }

  // ── HU-016: Sensaciones semanales ─────────────────────────────────────────

  /**
   * POST /instances/:planId/weeks/:weekId/feelings
   *
   * Registra o edita las sensaciones semanales de la instancia propia
   * (upsert — D-6b). Mismo orden de verificacion que resultados, sin el
   * paso de ejercicios: (1) Subscription Activa, (2) ownership de la
   * semana, (3) semana no cerrada.
   */
  @Post(':planId/weeks/:weekId/feelings')
  @Roles(UserRole.ATHLETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Registrar o editar las sensaciones semanales de la instancia propia',
    description:
      'Upsert de las sensaciones (dolor muscular, motivacion; escala entera 1-10 ' +
      'inclusive) de la semana :weekId de la instancia propia del atleta (CA-016-1, ' +
      'D-6b). Un valor fuera de 1-10 se rechaza con 400 (ValidationPipe global, ' +
      'CA-016-9) y no se guarda nada de esa semana. Orden de verificacion en el service: ' +
      '(1) Subscription Activa del atleta para :planId, si no CONSENT_REQUIRED (422, ' +
      'CA-016-5); (2) la semana pertenece a la instancia propia, si no ENTITY_NOT_FOUND ' +
      '(404) o RESOURCE_OWNERSHIP_DENIED (403, CA-016-4); (3) la semana no esta cerrada, ' +
      'si lo esta WEEK_FROZEN (409, CA-016-2). Dolor muscular y motivacion son datos ' +
      'sensibles de salud (Ley 1581/2012) — nunca se loggean, y este DTO de respuesta ' +
      'nunca se expone fuera de este endpoint o de GET /instances/:planId(/athletes/:athleteId) ' +
      '(CA-016-6). El consentimiento especifico de datos sensibles de salud (CA-016-8) ya ' +
      'se captura en subscriptions/accept-consent (D-14) — este endpoint no lo verifica ' +
      'de nuevo, la Subscription Activa ya lo implica. Solo accesible para ATHLETE.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Sensaciones semanales registradas o actualizadas exitosamente',
    type: WeeklyFeelingResponseDto,
  })
  @ApiProblemResponse(
    400,
    'muscleSoreness o motivation fuera del rango 1-10, o error de validacion en los ' +
      'datos de la solicitud (CA-016-9) — no se guarda ningun registro de sensaciones de ' +
      'esa semana',
  )
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'La semana pertenece a la instancia de otro atleta (RESOURCE_OWNERSHIP_DENIED, CA-016-4)',
  )
  @ApiProblemResponse(
    404,
    'Plan o semana no encontrados en la instancia propia',
  )
  @ApiProblemResponse(
    409,
    'Esta semana ya cerro y sus datos son definitivos (WEEK_FROZEN, CA-016-2)',
  )
  @ApiProblemResponse(
    422,
    'Se requiere una inscripcion activa con consentimiento informado aceptado ' +
      '(CONSENT_REQUIRED, CA-016-5)',
  )
  async registerWeeklyFeeling(
    @CurrentUser() user: AuthUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('weekId', ParseUUIDPipe) weekId: string,
    @Body() dto: RegisterWeeklyFeelingDto,
  ): Promise<WeeklyFeelingResponseDto> {
    return this.instancesService.registerWeeklyFeeling(
      user.id,
      planId,
      weekId,
      dto,
    );
  }
}
