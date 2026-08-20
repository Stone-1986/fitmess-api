import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { PlansService } from './plans.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PlanPublishedGuard } from '../common/guards/plan-published.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/auth-user.interface.js';
import { UserRole } from '../../../generated/prisma/index.js';
import { CreatePlanDto } from './dto/create-plan.dto.js';
import { UpdatePlanDto } from './dto/update-plan.dto.js';
import { AddPhaseDto } from './dto/add-phase.dto.js';
import { AddSessionDto } from './dto/add-session.dto.js';
import { AddSessionExerciseDto } from './dto/add-session-exercise.dto.js';
import { PlanResponseDto } from './dto/plan-response.dto.js';
import { PlanDetailResponseDto } from './dto/plan-detail-response.dto.js';
import { PhaseResponseDto } from './dto/phase-response.dto.js';
import { WeekResponseDto } from './dto/week-response.dto.js';
import { SessionResponseDto } from './dto/session-response.dto.js';
import { SessionExerciseResponseDto } from './dto/session-exercise-response.dto.js';

/**
 * PlansController — construccion, publicacion y ciclo de vida de planes de
 * entrenamiento del entrenador (EPICA-03).
 *
 * Ruta base: /plans
 * Todos los endpoints requieren autenticacion JWT y rol COACH exclusivamente
 * (RN-18, D-12) — a diferencia de ExercisesController, ADMIN NO tiene
 * ninguna funcion sobre planes (restriccion explicita del epica_input).
 *
 * Las rutas de estructura (phases/weeks/sessions/exercises) ademas exigen
 * PlanPublishedGuard: solo procede mientras el plan sigue en Borrador — la
 * estructura y las fechas quedan inmutables una vez publicado (RN-31).
 *
 * HU-008: creacion incremental del plan (shell + fases + semanas + sesiones + ejercicios)
 * HU-009: publicacion / despublicacion
 * HU-010: archivo manual
 *
 * El servicio asociado es PlansService (src/modules/plans/plans.service.ts).
 */
@ApiTags('plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COACH)
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // ── HU-008: Shell del plan ────────────────────────────────────────────────

  /**
   * POST /plans
   *
   * Crea el shell del plan (name obligatorio; description, startDate,
   * endDate opcionales) en estado Borrador, sin ninguna fase todavia
   * (CA-008-1/CA-008-2). RN-01 y RN-02 solo se verifican al publicar
   * (HU-009), nunca aqui (decision D-3).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear el shell de un plan de entrenamiento',
    description:
      'Crea el plan en estado Borrador con name obligatorio; description, startDate y ' +
      'endDate opcionales (D-3). CA-008-2 permite que el plan quede sin ninguna fase ' +
      'indefinidamente — RN-01 (estructura minima) y RN-02 (fecha de fin obligatoria) ' +
      'solo se verifican al publicar (HU-009), nunca al crear. Solo accesible para COACH (RN-18, D-12).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Plan creado exitosamente en estado Borrador',
    type: PlanResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos del plan')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Entrenador')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePlanDto,
  ): Promise<PlanResponseDto> {
    return this.plansService.create(user.id, dto);
  }

  /**
   * GET /plans
   *
   * Lista los planes propios del entrenador autenticado (todos los
   * estados), paginado. Endpoint de soporte no atado a una CA especifica —
   * necesario para que el entrenador ubique el borrador que esta
   * construyendo (decision D-8).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar los planes propios del entrenador autenticado',
    description:
      'Lista todos los planes del entrenador autenticado, en cualquier estado ' +
      '(Borrador, Publicado, Finalizado, Archivado), paginado. `status` refleja el ' +
      'valor efectivo de cada plan (D-1). Solo accesible para COACH.',
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
    description: 'Lista paginada de los planes propios del entrenador',
    type: PlanResponseDto,
    isArray: true,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(403, 'Acceso denegado — se requiere rol Entrenador')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: PlanResponseDto[]; meta: PaginationMeta }> {
    return this.plansService.findAll(user.id, page, limit);
  }

  /**
   * GET /plans/:id
   *
   * Detalle del plan propio con el arbol completo embebido: fases -> semanas
   * -> sesiones -> ejercicios de sesion (con name/description/muscleGroup/
   * versionNumber resueltos desde la ExerciseVersion referenciada). Un solo
   * GET agregado en vez de un GET por nivel (decision D-8). CA-008-6
   * (ownership) via findOwnedOrFail en el service.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener el detalle de un plan propio con su arbol completo',
    description:
      'Devuelve el plan con toda su estructura embebida: fases, semanas, sesiones y ' +
      'ejercicios de sesion, cada ejercicio con los datos de la version que la sesion ' +
      'conserva (RN-07). Lectura agregada en un solo GET (D-8). Solo el entrenador ' +
      'propietario del plan puede consultarlo (CA-008-6).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalle del plan con su arbol completo',
    type: PlanDetailResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede consultarlo (CA-008-6)',
  )
  @ApiProblemResponse(404, 'Plan no encontrado')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanDetailResponseDto> {
    return this.plansService.findOne(user.id, id);
  }

  /**
   * PATCH /plans/:id
   *
   * Edita name/description en cualquier estado; startDate/endDate solo si
   * el plan sigue en Borrador (RN-31 solo inmoviliza fechas y estructura al
   * publicar — decision D-6). CA-008-6 (ownership) via findOwnedOrFail.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Editar los datos generales de un plan propio',
    description:
      'name/description son editables en cualquier estado del plan (D-6). ' +
      'startDate/endDate solo se aceptan si el plan sigue en Borrador — si se envian ' +
      'con el plan ya publicado, rechaza con PLAN_IMMUTABLE (409) porque RN-31 ' +
      'inmoviliza la duracion total al publicar. Solo el entrenador propietario puede editarlo (CA-008-6).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan actualizado exitosamente',
    type: PlanResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos del plan')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede editarlo (CA-008-6)',
  )
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(
    409,
    'El plan no permite modificar fechas fuera del estado Borrador (RN-31, D-6)',
  )
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanResponseDto> {
    return this.plansService.update(user.id, id, dto);
  }

  // ── HU-008: Estructura — fases ────────────────────────────────────────────

  /**
   * POST /plans/:id/phases
   *
   * Agrega una fase al plan. order se calcula en el service (maximo order
   * existente + 1) — el DTO no lo recibe (decision D-5). PlanPublishedGuard
   * rechaza si el plan no esta en Borrador.
   */
  @Post(':id/phases')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Agregar una fase al plan',
    description:
      'Crea una fase dentro del plan. order se calcula server-side (maximo order ' +
      'existente en el plan + 1, D-5). Solo procede si el plan sigue en Borrador — ' +
      'una fase nueva es estructura, inmutable tras publicar (RN-31, PlanPublishedGuard).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Fase creada exitosamente',
    type: PhaseResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos de la fase')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  async addPhase(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPhaseDto,
  ): Promise<PhaseResponseDto> {
    return this.plansService.addPhase(user.id, id, dto);
  }

  /**
   * DELETE /plans/:id/phases/:phaseId
   *
   * Quita una fase (y en cascada sus semanas/sesiones/ejercicios de sesion —
   * hard-delete real, no soft-delete: solo procede en Borrador, donde nada
   * ha sido usado todavia por un atleta — decision D-7).
   */
  @Delete(':id/phases/:phaseId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Quitar una fase del plan',
    description:
      'Elimina la fase y, en cascada, sus semanas, sesiones y ejercicios de sesion ' +
      '(hard-delete real — D-7, solo procede en Borrador, donde ningun atleta ha tenido ' +
      'contacto con esa estructura todavia). PlanPublishedGuard rechaza si el plan ya no esta en Borrador.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fase eliminada exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { nullable: true, example: null },
        message: { type: 'string', example: 'Fase eliminada exitosamente' },
      },
    },
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(404, 'Plan o fase no encontrados')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  async removePhase(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
  ): Promise<{ data: null; message: string }> {
    return this.plansService.removePhase(user.id, id, phaseId);
  }

  // ── HU-008: Estructura — semanas ──────────────────────────────────────────

  /**
   * POST /plans/:id/phases/:phaseId/weeks
   *
   * Agrega una semana a una fase. Sin request body — weekNumber se calcula
   * en el service como secuencial a lo largo de TODO el plan, no reinicia
   * por fase (decision D-4).
   */
  @Post(':id/phases/:phaseId/weeks')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Agregar una semana a una fase',
    description:
      'Crea una semana dentro de la fase. Sin request body — weekNumber se calcula ' +
      'server-side como secuencial a lo largo de TODO el plan (no reinicia por fase, D-4), ' +
      'porque EPICA-05 necesita un numero de semana unico y comparable entre fases. ' +
      'Solo procede si el plan sigue en Borrador (RN-31, PlanPublishedGuard).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Semana creada exitosamente',
    type: WeekResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(404, 'Plan o fase no encontrados')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  async addWeek(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('phaseId', ParseUUIDPipe) phaseId: string,
  ): Promise<WeekResponseDto> {
    return this.plansService.addWeek(user.id, id, phaseId);
  }

  /**
   * DELETE /plans/:id/weeks/:weekId
   *
   * Quita una semana (cascada a sus sesiones y ejercicios de sesion). Ruta
   * plana — weekId ya identifica univocamente sin arrastrar phaseId
   * (decision D-9).
   */
  @Delete(':id/weeks/:weekId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Quitar una semana del plan',
    description:
      'Elimina la semana y, en cascada, sus sesiones y ejercicios de sesion (hard-delete ' +
      'real — D-7). Ruta plana con weekId, sin arrastrar phaseId (D-9). Solo procede en Borrador.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Semana eliminada exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { nullable: true, example: null },
        message: { type: 'string', example: 'Semana eliminada exitosamente' },
      },
    },
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(404, 'Plan o semana no encontrados')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  async removeWeek(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('weekId', ParseUUIDPipe) weekId: string,
  ): Promise<{ data: null; message: string }> {
    return this.plansService.removeWeek(user.id, id, weekId);
  }

  // ── HU-008: Estructura — sesiones ─────────────────────────────────────────

  /**
   * POST /plans/:id/weeks/:weekId/sessions
   *
   * Agrega una sesion a una semana. order calculado en el service (maximo
   * order existente en la semana + 1).
   */
  @Post(':id/weeks/:weekId/sessions')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Agregar una sesion a una semana',
    description:
      'Crea una sesion dentro de la semana. order se calcula server-side (maximo order ' +
      'existente en la semana + 1, D-5). Solo procede si el plan sigue en Borrador.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Sesion creada exitosamente',
    type: SessionResponseDto,
  })
  @ApiProblemResponse(400, 'Error de validacion en los datos de la sesion')
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(404, 'Plan o semana no encontrados')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  async addSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('weekId', ParseUUIDPipe) weekId: string,
    @Body() dto: AddSessionDto,
  ): Promise<SessionResponseDto> {
    return this.plansService.addSession(user.id, id, weekId, dto);
  }

  /**
   * DELETE /plans/:id/sessions/:sessionId
   *
   * Quita una sesion (cascada a sus ejercicios de sesion). Ruta plana
   * (decision D-9).
   */
  @Delete(':id/sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Quitar una sesion del plan',
    description:
      'Elimina la sesion y, en cascada, sus ejercicios de sesion (hard-delete real — D-7). ' +
      'Ruta plana con sessionId (D-9). Solo procede en Borrador.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sesion eliminada exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: { nullable: true, example: null },
        message: { type: 'string', example: 'Sesion eliminada exitosamente' },
      },
    },
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(404, 'Plan o sesion no encontrados')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  async removeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<{ data: null; message: string }> {
    return this.plansService.removeSession(user.id, id, sessionId);
  }

  // ── HU-008 (CA-008-3): Estructura — ejercicios de sesion ─────────────────

  /**
   * POST /plans/:id/sessions/:sessionId/exercises
   *
   * Agrega un ejercicio de la biblioteca global a una sesion. El service
   * resuelve exerciseId -> ExerciseVersion vigente y persiste
   * SessionExercise.exerciseVersionId — nunca un puntero al ejercicio
   * (RN-07). Rechaza con ENTITY_NOT_FOUND si el ejercicio no existe (RN-04)
   * y con EXERCISE_INACTIVE (422) si esta inhabilitado — mismo precedente
   * que CA-006-6 de EPICA-02. Esta es la escritura que hace real
   * isUsedInPlan() de EPICA-02 (D-2).
   */
  @Post(':id/sessions/:sessionId/exercises')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Agregar un ejercicio de la biblioteca a una sesion',
    description:
      'Agrega un ejercicio de la biblioteca global (Exercise) a una sesion (CA-008-3). ' +
      'El service resuelve exerciseId -> ExerciseVersion vigente (mayor versionNumber) en ' +
      'el momento de la llamada y persiste SessionExercise.exerciseVersionId — nunca un ' +
      'puntero al ejercicio (RN-07), de modo que si el ejercicio se modifica o se inhabilita ' +
      'despues, la sesion conserva la version original. Rechaza con ENTITY_NOT_FOUND (404) ' +
      'si el ejercicio no existe en la biblioteca global (RN-04), y con EXERCISE_INACTIVE (422) ' +
      'si existe pero esta inhabilitado (isActive=false) — mismo precedente que CA-006-6 de ' +
      'EPICA-02. Esta operacion es la que hace real isUsedInPlan(exerciseId) de EPICA-02 (D-2). ' +
      'Solo procede si el plan sigue en Borrador.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ejercicio agregado exitosamente a la sesion',
    type: SessionExerciseResponseDto,
  })
  @ApiProblemResponse(
    400,
    'Error de validacion en los datos del ejercicio de sesion',
  )
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(
    404,
    'Plan o sesion no encontrados, o el ejercicio referenciado no existe en la biblioteca global (RN-04)',
  )
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  @ApiProblemResponse(
    422,
    'El ejercicio referenciado existe pero esta inhabilitado en la biblioteca global (EXERCISE_INACTIVE)',
  )
  async addSessionExercise(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: AddSessionExerciseDto,
  ): Promise<SessionExerciseResponseDto> {
    return this.plansService.addSessionExercise(user.id, id, sessionId, dto);
  }

  /**
   * DELETE /plans/:id/sessions/:sessionId/exercises/:sessionExerciseId
   *
   * Quita un ejercicio de una sesion.
   */
  @Delete(':id/sessions/:sessionId/exercises/:sessionExerciseId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlanPublishedGuard)
  @ApiOperation({
    summary: 'Quitar un ejercicio de una sesion',
    description:
      'Elimina el ejercicio de sesion (hard-delete real — D-7). Solo procede si el plan ' +
      'sigue en Borrador.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ejercicio eliminado exitosamente de la sesion',
    schema: {
      type: 'object',
      properties: {
        data: { nullable: true, example: null },
        message: {
          type: 'string',
          example: 'Ejercicio eliminado exitosamente de la sesion',
        },
      },
    },
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede modificarlo',
  )
  @ApiProblemResponse(404, 'Plan, sesion o ejercicio de sesion no encontrados')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — la estructura ya es inmutable (RN-31)',
  )
  async removeSessionExercise(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('sessionExerciseId', ParseUUIDPipe) sessionExerciseId: string,
  ): Promise<{ data: null; message: string }> {
    return this.plansService.removeSessionExercise(
      user.id,
      id,
      sessionId,
      sessionExerciseId,
    );
  }

  // ── HU-009: Publicacion ───────────────────────────────────────────────────

  /**
   * POST /plans/:id/publish
   *
   * Borrador -> Publicado. Rechaza con INVALID_STATE_TRANSITION (409) si el
   * estado actual no es Borrador; con PLAN_INCOMPLETE (422) si no cumple
   * RN-01 (CA-009-2). No usa PlanPublishedGuard — la transicion misma es el
   * objeto de la verificacion. findOwnedOrFail cubre CA-009-5.
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publicar un plan (Borrador -> Publicado)',
    description:
      'Transiciona el plan de Borrador a Publicado. Rechaza con INVALID_STATE_TRANSITION ' +
      '(409) si el estado actual no es Borrador; con PLAN_INCOMPLETE (422) si el plan no ' +
      'cumple RN-01 (name + fechas + al menos una fase con una semana con una sesion con ' +
      'un ejercicio — CA-009-2), listando explicitamente los requisitos faltantes. Emite ' +
      'el evento plan.published. Solo el entrenador propietario puede publicar (CA-009-5).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan publicado exitosamente',
    type: PlanResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede publicarlo (CA-009-5)',
  )
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(
    409,
    'El plan no esta en Borrador — no puede publicarse desde su estado actual',
  )
  @ApiProblemResponse(
    422,
    'El plan no cumple los requisitos minimos de validez para publicarse (RN-01, CA-009-2)',
  )
  async publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanResponseDto> {
    return this.plansService.publish(user.id, id);
  }

  /**
   * POST /plans/:id/unpublish
   *
   * Publicado -> Borrador. Rechaza con INVALID_STATE_TRANSITION (409) si el
   * estado actual no es Publicado; con PLAN_HAS_SUBSCRIBERS (409) si
   * hasSubscribers(planId) retorna true (CA-009-7). hasSubscribers es un
   * stub que hoy siempre retorna false — gap declarado, no verificable e2e
   * en esta epica.
   */
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Despublicar un plan (Publicado -> Borrador)',
    description:
      'Transiciona el plan de Publicado a Borrador. Rechaza con INVALID_STATE_TRANSITION ' +
      '(409) si el estado actual no es Publicado; con PLAN_HAS_SUBSCRIBERS (409) si el plan ' +
      'tiene atletas suscritos (CA-009-7). hasSubscribers(planId) es un stub que hoy ' +
      'siempre retorna false (mismo patron que isUsedInPlan de EPICA-02) — la rama "con ' +
      'suscritos" no es verificable end-to-end en esta epica, solo con test unitario. ' +
      'Solo el entrenador propietario puede despublicar (CA-009-5).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan despublicado exitosamente',
    type: PlanResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede despublicarlo (CA-009-5)',
  )
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(
    409,
    'El plan no esta en Publicado, o tiene atletas suscritos y no puede regresar a Borrador (CA-009-7)',
  )
  async unpublish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanResponseDto> {
    return this.plansService.unpublish(user.id, id);
  }

  // ── HU-010: Archivo ───────────────────────────────────────────────────────

  /**
   * POST /plans/:id/archive
   *
   * Borrador, Publicado o Finalizado -> Archivado (CA-010-2). Rechaza con
   * INVALID_STATE_TRANSITION (409) si ya esta Archivado (CA-010-3). No
   * verifica hasSubscribers. Emite plan.finalized antes de archivar solo si
   * corresponde (D-1), y siempre plan.archived.
   */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archivar un plan manualmente',
    description:
      'Transiciona el plan a Archivado desde Borrador, Publicado o Finalizado (CA-010-2). ' +
      'Rechaza con INVALID_STATE_TRANSITION (409) si el plan ya esta Archivado (CA-010-3). ' +
      'No verifica atletas suscritos — RN-27/CA-010-2 no lo exigen para archivar, a ' +
      'diferencia de unpublish. Un plan Publicado ya vencido (endDate pasada) se archiva ' +
      'sin problema aunque la columna persistida aun diga PUBLISHED (D-1). Emite ' +
      'plan.finalized antes de archivar solo si corresponde, y siempre plan.archived. ' +
      'Solo el entrenador propietario puede archivarlo (CA-010-4).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Plan archivado exitosamente',
    type: PlanResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'No tiene acceso a este plan — solo el entrenador propietario puede archivarlo (CA-010-4)',
  )
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(409, 'El plan ya esta archivado (CA-010-3)')
  async archive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanResponseDto> {
    return this.plansService.archive(user.id, id);
  }
}
