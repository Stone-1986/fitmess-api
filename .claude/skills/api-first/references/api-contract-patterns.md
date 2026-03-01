# API Contract Patterns — Referencia completa

Ejemplos de implementacion para contratos OpenAPI y planes de implementacion.

## Tabla de contenido

1. [Controller template completo](#1-controller-template-completo)
2. [ProblemDetailDto — Swagger schema](#2-problemdetaildto--swagger-schema)
3. [Plan de Implementacion YAML](#3-plan-de-implementacion-yaml)

---

## 1. Controller template completo

Template de un controller CRUD + state machine con todos los decoradores Swagger.

```typescript
@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {

  // ── Crear ──────────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.COACH)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear plan de entrenamiento' })
  @ApiResponse({ status: 201, description: 'Plan creado', type: PlanResponseDto })
  @ApiProblemResponse(400, 'Error de validacion en los datos del plan')
  @ApiProblemResponse(401, 'No autenticado')
  @ApiProblemResponse(403, 'Rol insuficiente')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePlanDto,
  ): Promise<PlanResponseDto> {
    return this.plansService.create(user.id, dto);
  }

  // ── Listar ─────────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.COACH)
  @ApiOperation({ summary: 'Listar planes del coach autenticado' })
  @ApiResponse({ status: 200, description: 'Lista paginada de planes', type: PlanListResponseDto })
  @ApiProblemResponse(401, 'No autenticado')
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationDto,
  ): Promise<{ data: PlanResponseDto[]; meta: PaginationMeta }> {
    return this.plansService.findAll(user.id, query);
  }

  // ── Detalle ────────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Obtener plan por ID' })
  @ApiResponse({ status: 200, description: 'Plan encontrado', type: PlanResponseDto })
  @ApiProblemResponse(401, 'No autenticado')
  @ApiProblemResponse(403, 'Sin acceso a este plan')
  @ApiProblemResponse(404, 'Plan no encontrado')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanResponseDto> {
    return this.plansService.findOne(id, user.id);
  }

  // ── Accion de estado ───────────────────────────────────────────────
  @Post(':id/publish')
  @Roles(UserRole.COACH)
  @ApiOperation({ summary: 'Publicar plan (DRAFT → PUBLISHED)' })
  @ApiResponse({ status: 200, description: 'Plan publicado', type: PlanResponseDto })
  @ApiProblemResponse(401, 'No autenticado')
  @ApiProblemResponse(403, 'No es propietario de este plan')
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(409, 'Transicion de estado invalida')
  @ApiProblemResponse(422, 'Plan incompleto — falta nombre, fechas o sesiones')
  async publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PlanResponseDto> {
    return this.plansService.publish(id, user.id);
  }

  // ── Soft-delete ────────────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.COACH)
  @ApiOperation({ summary: 'Archivar plan (soft-delete)' })
  @ApiResponse({ status: 200, description: 'Plan archivado' })
  @ApiProblemResponse(401, 'No autenticado')
  @ApiProblemResponse(403, 'Sin acceso a este plan')
  @ApiProblemResponse(404, 'Plan no encontrado')
  @ApiProblemResponse(409, 'El plan tiene suscriptores activos')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.plansService.remove(id, user.id);
  }
}
```

**Notas:**
- El controller es THIN: solo delega al service
- `findAll` retorna `{ data, meta }` que el `ResponseInterceptor` envuelve
- `remove` (soft-delete): el service retorna `{ data: null, message: '...' }` — el controller solo pasa el resultado sin tipo explicito

---

## 2. ProblemDetailDto — Swagger schema

La clase `ProblemDetailDto` vive en `src/modules/common/swagger/error-responses.ts` junto con el decorador `ApiProblemResponse`. Es exclusiva para Swagger — no se instancia en runtime. La interface `ProblemDetail` (runtime) vive aparte en `exceptions/problem-detail.dto.ts`.

```typescript
// src/modules/common/swagger/error-responses.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemDetailDto {
  @ApiProperty({ description: 'URI del tipo de error', example: 'https://api.fitmess.co/errors/ENTITY_NOT_FOUND' })
  type: string;

  @ApiProperty({ description: 'Resumen estable del error', example: 'Recurso no encontrado' })
  title: string;

  @ApiProperty({ description: 'HTTP status code', example: 404 })
  status: number;

  @ApiProperty({ description: 'Descripcion especifica de esta ocurrencia', example: "Plan con id 'abc-123' no fue encontrado" })
  detail: string;

  @ApiProperty({ description: 'Codigo maquina del error', example: 'ENTITY_NOT_FOUND' })
  errorCode: string;

  @ApiPropertyOptional({ description: 'Path del request', example: '/api/plans/abc-123' })
  instance?: string;

  @ApiPropertyOptional({ description: 'UUID del request para trazabilidad', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  correlationId?: string;

  @ApiProperty({ description: 'Timestamp ISO 8601', example: '2026-03-15T14:30:45.123Z' })
  timestamp: string;

  @ApiPropertyOptional({ description: 'Datos adicionales de contexto' })
  context?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Errores de validacion por campo', type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } })
  errors?: { field: string; message: string }[];
}
```

> **Organizacion de archivos:** `ProblemDetail` interface (runtime) en `exceptions/problem-detail.dto.ts`. `ProblemDetailDto` clase (Swagger) + `ApiProblemResponse` decorator en `swagger/error-responses.ts`. Ambos en `src/modules/common/`.

---

## 3. Plan de Implementacion YAML

Formato YAML que genera el Arquitecto. El Documentador lo usa para generar los decoradores OpenAPI. Esta es la **fuente de verdad canonica** del formato — el agente `arquitecto.md` produce exactamente esta estructura.

```yaml
plan_de_implementacion:
  version: "1.0"
  epica_id: "EPICA-03"
  ciclo: 1              # Numero de ciclo que produjo esta version. 1 en produccion inicial
  razonamiento: ""      # Omitir en ciclo 1. Obligatorio desde ciclo 2 — QUE; POR QUE; REFERENCIA (max 300 chars)
  modulos_afectados:
    - plans
    - subscriptions (evento plan.published)
    - notifications (evento plan.published)
  endpoints:
    - hu_id: "HU-010"
      metodo: POST
      ruta: /plans
      proposito: Crear plan en estado DRAFT
      request_body: CreatePlanDto
      response: PlanResponseDto (201)
      errores: [400, 401, 403]
      guards: [JwtAuthGuard, RolesGuard(COACH)]
      eventos: []
      dependencias: []

    - hu_id: "HU-011"
      metodo: POST
      ruta: /plans/:id/publish
      proposito: Transicionar plan de DRAFT a PUBLISHED
      response: PlanResponseDto (200)
      errores: [401, 403, 404, 409, 422]
      guards: [JwtAuthGuard, RolesGuard(COACH), ResourcePolicyGuard]
      eventos: [plan.published]
      dependencias: [POST /plans]

  orden_de_implementacion:
    - POST /plans
    - GET /plans
    - GET /plans/:id
    - PATCH /plans/:id
    - POST /plans/:id/publish
    - POST /plans/:id/unpublish
    - DELETE /plans/:id

  decisiones_arquitectonicas:
    - decision: Las acciones de state machine son endpoints POST separados
      justificacion: Semantica REST clara, cada transicion tiene sus propias validaciones y errores

  criterios_de_aceptacion_tecnicos:
    - Cobertura de dominio >= 80%
    - Cobertura de adaptadores >= 70%
    - Todos los errores documentados con ApiProblemResponse

  riesgos_identificados:
    - La validacion de completitud del plan (RN-01) requiere cargar sesiones y bloques
```

**Campos por endpoint:**

| Campo | Descripcion | Obligatorio |
|-------|-------------|:-----------:|
| `hu_id` | HU que justifica el endpoint — trazabilidad | Si |
| `metodo` | GET, POST, PATCH, DELETE | Si |
| `ruta` | Ingles, plural, UUIDs con ParseUUIDPipe | Si |
| `proposito` | Descripcion breve | Si |
| `request_body` | Nombre del DTO de entrada (si aplica) | No |
| `response` | Nombre del DTO de respuesta + codigo HTTP | Si |
| `errores` | Lista de status codes documentados | Si |
| `guards` | Guards aplicados (del pipeline de nestjs-conventions) | Si |
| `eventos` | Eventos emitidos (del catalogo de design-patterns §7) | Si |
| `dependencias` | Endpoints que deben existir antes | Si |
