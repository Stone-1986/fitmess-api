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
import { ExercisesService } from './exercises.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../../../generated/prisma/index.js';
import { CreateExerciseDto } from './dto/create-exercise.dto.js';
import { UpdateExerciseDto } from './dto/update-exercise.dto.js';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto.js';
import { ExerciseResponseDto } from './dto/exercise-response.dto.js';
import { ExerciseSummaryResponseDto } from './dto/exercise-summary-response.dto.js';
import { ExerciseDetailResponseDto } from './dto/exercise-detail-response.dto.js';

/**
 * ExercisesController — biblioteca global de ejercicios (EPICA-02).
 *
 * Ruta base: /exercises
 * Todos los endpoints requieren autenticacion JWT y rol COACH o ADMIN
 * (RN-22 — el atleta no accede a la gestion del catalogo, ni siquiera al
 * listado o detalle: su acceso al catalogo via planes es contenido de EPICA-03).
 *
 * HU-005: POST /exercises            — crear ejercicio (Exercise + primera ExerciseVersion)
 * HU-005 (CA-005-3) / HU-007 (CA-007-2): GET /exercises  — listar catalogo (paginado)
 * HU-006 (CA-006-2) / HU-007 (CA-007-3): GET /exercises/:id — detalle + historial de versiones
 * HU-006: PATCH /exercises/:id       — modificar ejercicio (edicion in-place o nueva version)
 * HU-007: DELETE /exercises/:id      — inhabilitar ejercicio (soft-delete via isActive)
 *
 * El servicio asociado es ExercisesService (src/modules/exercises/exercises.service.ts).
 */
@ApiTags('exercises')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COACH, UserRole.ADMIN)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  // ── HU-005: Crear ejercicio ───────────────────────────────────────────────

  /**
   * POST /exercises
   *
   * Crea Exercise + su primera ExerciseVersion (versionNumber = 1) en una sola
   * $transaction atomica — un Exercise sin ninguna version es un estado
   * invalido del dominio (CA-005-1). isActive queda en true por defecto.
   *
   * Verifica previamente que no exista otro ejercicio ACTIVO con el mismo
   * name (comparacion case-insensitive, con trim) y rechaza con
   * DUPLICATE_ENTITY si lo hay (CA-005-2). Un name que solo existe en
   * ejercicios inhabilitados NO bloquea la creacion (CA-005-6).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear ejercicio en la biblioteca global',
    description:
      'Crea un Exercise y su primera ExerciseVersion (versionNumber = 1) en una sola ' +
      'transaccion atomica ($transaction) — un Exercise sin ninguna version es un estado ' +
      'invalido del dominio (CA-005-1). isActive queda en true por defecto. ' +
      'Verifica previamente que no exista otro ejercicio ACTIVO con el mismo name ' +
      '(comparacion case-insensitive, con trim de espacios) y rechaza con DUPLICATE_ENTITY ' +
      'si lo hay (CA-005-2). Un name que solo existe en un ejercicio inhabilitado NO bloquea ' +
      'la creacion — puede reutilizarse de inmediato (CA-005-6). Visible de inmediato en el ' +
      'catalogo, sin ningun paso de aprobacion (CA-005-3). Solo accesible para COACH y ADMIN (RN-22).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      'Ejercicio creado exitosamente con su primera version (versionNumber = 1).',
    type: ExerciseResponseDto,
  })
  @ApiProblemResponse(
    400,
    'Error de validacion en los datos del ejercicio (name, description o muscleGroup vacios o exceden longitud)',
  )
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Entrenador o Administrador',
  )
  @ApiProblemResponse(
    409,
    'Ya existe un ejercicio activo con ese nombre (CA-005-2) — comparacion case-insensitive con trim',
  )
  async create(@Body() dto: CreateExerciseDto): Promise<ExerciseResponseDto> {
    return this.exercisesService.create(dto);
  }

  // ── HU-005 (CA-005-3) + HU-007 (CA-007-2): Listado del catalogo ──────────

  /**
   * GET /exercises
   *
   * Lista el catalogo global de ejercicios con su version vigente embebida.
   * Por defecto filtra isActive = true — los inhabilitados no aparecen
   * (CA-007-2). Acepta includeInactive=true para auditar el catalogo
   * completo. Paginado con page/limit.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar el catalogo global de ejercicios',
    description:
      'Lista el catalogo de ejercicios con la version vigente embebida (name, description, ' +
      'muscleGroup y versionNumber de la ExerciseVersion de mayor versionNumber). Por defecto ' +
      'filtra isActive=true — los ejercicios inhabilitados no aparecen (CA-007-2). Con ' +
      'includeInactive=true se incluyen tambien los inhabilitados, unica via para auditar el ' +
      'catalogo completo en bloque ya que esta epica no define reactivacion. Con ' +
      'includeInactive=true el listado puede mostrar dos filas con el mismo name (una activa, ' +
      'una inhabilitada) — consecuencia aceptada de CA-005-6, el campo isActive de cada fila ' +
      'permite distinguirlas. Paginado (page=1, limit=20 por defecto, max 100). ' +
      'Solo accesible para COACH y ADMIN.',
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
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description:
      'Incluir ejercicios inhabilitados en el listado (default false)',
    example: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista paginada de ejercicios que coinciden con el filtro',
    type: ExerciseSummaryResponseDto,
    isArray: true,
  })
  @ApiProblemResponse(
    400,
    'Error de validacion en los query params (page/limit fuera de rango, tipo invalido)',
  )
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Entrenador o Administrador',
  )
  async findAll(
    @Query() query: ListExercisesQueryDto,
  ): Promise<{ data: ExerciseSummaryResponseDto[]; meta: PaginationMeta }> {
    return this.exercisesService.findAll(query);
  }

  // ── HU-006 (CA-006-2) + HU-007 (CA-007-3): Detalle con historial ─────────

  /**
   * GET /exercises/:id
   *
   * Retorna el detalle de un ejercicio: sus datos vigentes mas el historial
   * completo de versiones (CA-006-2). No filtra por isActive — un ejercicio
   * inhabilitado se lee igual, con su estado visible (CA-007-3).
   *
   * ParseUUIDPipe valida que :id sea un UUID v4 valido.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener el detalle de un ejercicio con su historial de versiones',
    description:
      'Retorna el detalle de un ejercicio: sus datos vigentes (name, isActive, description, ' +
      'muscleGroup y versionNumber de la version de mayor versionNumber) mas el historial ' +
      'completo de versiones (versionNumber + createdAt de cada una — CA-006-2). No filtra por ' +
      'isActive: un ejercicio inhabilitado se lee igual, con su estado inactivo visible, para ' +
      'que un plan historico pueda mostrarlo indicando que ya no esta activo en la biblioteca ' +
      '(CA-007-3). Solo accesible para COACH y ADMIN.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Detalle del ejercicio encontrado, incluyendo su historial de versiones',
    type: ExerciseDetailResponseDto,
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Entrenador o Administrador',
  )
  @ApiProblemResponse(404, 'Ejercicio no encontrado')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ExerciseDetailResponseDto> {
    return this.exercisesService.findOne(id);
  }

  // ── HU-006: Modificar ejercicio ───────────────────────────────────────────

  /**
   * PATCH /exercises/:id
   *
   * Actualiza un ejercicio existente. Orden de validaciones en el service:
   * (1) el ejercicio debe existir (CA-006-4); (2) si isActive=false, rechaza
   * inmediatamente con EXERCISE_INACTIVE sin crear version nueva ni alterar
   * la vigente (CA-006-6); (3) si se envia name, valida unicidad
   * case-insensitive con trim contra otros ejercicios ACTIVOS; (4) si se
   * envia description y/o muscleGroup, crea una version nueva (CA-006-1) o
   * edita la vigente in-place (CA-006-3) segun si el ejercicio ya fue usado
   * en un plan.
   *
   * ParseUUIDPipe valida que :id sea un UUID v4 valido.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Modificar un ejercicio existente',
    description:
      'Actualiza un ejercicio existente. Si el ejercicio ya esta inhabilitado (isActive=false), ' +
      'rechaza con EXERCISE_INACTIVE (422) sin crear version nueva ni alterar la vigente ' +
      '(CA-006-6). name es identidad del catalogo (Exercise, no versionado): si se envia, se ' +
      'valida unicidad case-insensitive con trim contra otros ejercicios ACTIVOS excluyendo el ' +
      'propio, rechazando con DUPLICATE_ENTITY si colisiona. description y muscleGroup son ' +
      'contenido de entrenamiento (ExerciseVersion): si el ejercicio ya fue usado en un plan, ' +
      'se crea una ExerciseVersion nueva con versionNumber incrementado (CA-006-1); si no, se ' +
      'edita la version vigente in-place (CA-006-3). Solo accesible para COACH y ADMIN.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ejercicio actualizado exitosamente',
    type: ExerciseResponseDto,
  })
  @ApiProblemResponse(
    400,
    'Error de validacion en los datos del ejercicio (campos exceden longitud o formato invalido)',
  )
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Entrenador o Administrador',
  )
  @ApiProblemResponse(404, 'Ejercicio no encontrado (CA-006-4)')
  @ApiProblemResponse(
    409,
    'Ya existe otro ejercicio activo con ese nombre (CA-005-2) — comparacion case-insensitive con trim',
  )
  @ApiProblemResponse(
    422,
    'El ejercicio ya esta inhabilitado — no admite modificaciones (CA-006-6)',
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
  ): Promise<ExerciseResponseDto> {
    return this.exercisesService.update(id, dto);
  }

  // ── HU-007: Inhabilitar ejercicio ─────────────────────────────────────────

  /**
   * DELETE /exercises/:id
   *
   * Inhabilita un ejercicio (isActive=false). Soft-delete propio de
   * ejercicios (isActive, no archivedAt). SIEMPRE procede, este o no el
   * ejercicio en uso — NUNCA se bloquea con EXERCISE_IN_USE (CA-007-1).
   * Si el ejercicio ya estaba inhabilitado, rechaza con EXERCISE_INACTIVE
   * (CA-007-4).
   *
   * ParseUUIDPipe valida que :id sea un UUID v4 valido.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inhabilitar un ejercicio de la biblioteca (soft-delete)',
    description:
      'Inhabilita un ejercicio (isActive=false). Sigue el patron de soft-delete del proyecto ' +
      '(DELETE actualiza un flag, nunca borra fisicamente), con la convencion propia de ' +
      'ejercicios: el campo interno es isActive, no archivedAt. La operacion SIEMPRE procede, ' +
      'este o no el ejercicio en uso — NUNCA se verifica ni se bloquea por EXERCISE_IN_USE ' +
      '(CA-007-1). Las versiones y el ejercicio no se tocan; los planes existentes conservan ' +
      'intacta la version que ya referenciaban (RN-07). El name queda disponible de inmediato ' +
      'para que otro ejercicio nuevo o renombrado lo use (CA-005-6). Si el ejercicio ya estaba ' +
      'inhabilitado, rechaza con EXERCISE_INACTIVE (CA-007-4). Solo accesible para COACH y ADMIN.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ejercicio inhabilitado exitosamente',
    schema: {
      type: 'object',
      properties: {
        // `type: 'null'` es JSON Schema 2020-12 / OpenAPI 3.1, y DocumentBuilder
        // genera 3.0. En 3.0 la forma de expresar un valor nulo es `nullable`.
        data: { nullable: true, example: null },
        message: {
          type: 'string',
          example: 'Ejercicio inhabilitado exitosamente',
        },
      },
    },
  })
  @ApiProblemResponse(401, 'No autenticado — se requiere token JWT valido')
  @ApiProblemResponse(
    403,
    'Acceso denegado — se requiere rol Entrenador o Administrador',
  )
  @ApiProblemResponse(404, 'Ejercicio no encontrado')
  @ApiProblemResponse(422, 'El ejercicio ya estaba inhabilitado (CA-007-4)')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: null; message: string }> {
    return this.exercisesService.deactivate(id);
  }
}
