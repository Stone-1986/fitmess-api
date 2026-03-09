---
name: nestjs-conventions
description: Convenciones NestJS para fitmess-api. Cargar al crear o modificar módulos, controllers, services, DTOs, o response envelope. Cubre estructura interna de módulos, controller thin, ValidationPipe, comunicación entre módulos y pipeline global de request.
---

# NestJS Conventions — fitmess-api

## 1. Estructura interna de módulos

```
src/modules/[module-name]/
  dto/
    create-[entity].dto.ts
    update-[entity].dto.ts
    [entity]-response.dto.ts
  guards/
    [guard-name].guard.ts
  listeners/
    [event-name].listener.ts
  [module-name].controller.ts
  [module-name].service.ts
  [module-name].module.ts
  [module-name].controller.spec.ts
  [module-name].service.spec.ts
```

### Multi-feature modules (feature folders)

Cuando un módulo crece con múltiples features (ej: auth tiene core, coach-requests, admin-invitations), se organiza en feature folders. El `@Module()` sigue siendo único — los subfolders NO son módulos NestJS.

```
src/modules/[module-name]/
  [module-name].module.ts           ← único @Module(), importa desde subfolders
  core/                             ← feature principal
    [module-name].controller.ts
    [module-name].service.ts
    dto/
  [feature-name]/                   ← feature adicional
    [feature-name].controller.ts
    [feature-name].service.ts
    dto/
  shared/                           ← compartido entre features
    decorators/
    guards/
    strategies/
```

**Reglas:**
- Los subfolders NO son `@Module()` — son solo organización de archivos
- Los imports dentro del mismo módulo son directos (no vía eventos)
- Cada feature tiene su propio `dto/` subfolder
- El folder `shared/` contiene guards, decorators y strategies usados por múltiples features
- Los specs viven junto a su archivo fuente dentro de cada feature

---

## 2. Controller THIN — template

```typescript
@Post()
@Roles(UserRole.COACH)
@ApiOperation({ summary: 'Crear plan de entrenamiento' })
@ApiResponse({ status: 201, type: PlanResponseDto })
@ApiProblemResponse(400, 'Error de validación')
@ApiProblemResponse(422, 'Plan incompleto')
async create(
  @CurrentUser() user: AuthUser,
  @Body() dto: CreatePlanDto,
): Promise<PlanResponseDto> {
  return this.planService.create(user.id, dto);
}
```

---

## 3. DTOs

### DTO de entrada

```typescript
export class CreatePlanDto {
  @ApiProperty({ description: 'Nombre del plan', example: 'Fuerza Fase 1' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @ApiProperty({ description: 'Fecha de inicio', example: '2026-03-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ type: [CreateSessionDto], minItems: 1 })
  @ValidateNested({ each: true })
  @Type(() => CreateSessionDto)
  @ArrayMinSize(1, { message: 'El plan debe tener al menos una sesión (RN-01)' })
  sessions: CreateSessionDto[];
}
```

### DTO de salida

```typescript
export class PlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: PlanStatus })
  status: PlanStatus;
}
```

**Convenciones:**
- Todo DTO de entrada usa `@ApiProperty()` para Swagger

---

## 4. ValidationPipe global

Configurado en `main.ts`. No modificar sin justificación:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // Elimina propiedades no declaradas en el DTO
    forbidNonWhitelisted: true, // Rechaza con 400 si envían propiedades desconocidas
    transform: true,            // Transforma payloads a instancias del DTO
    transformOptions: {
      enableImplicitConversion: true,
    },
  }),
);
```

---

## 5. Response Envelope

```typescript
// Respuesta individual — el controller retorna solo el objeto
async findOne(@Param('id') id: string): Promise<PlanResponseDto> {
  return this.planService.findOne(id);
}

// Respuesta paginada — el controller retorna { data, meta }
async findAll(@Query() query: PaginationDto) {
  return this.planService.findAll(query); // service retorna { data: Plan[], meta: PaginationMeta }
}
```

El interceptor produce:
```json
// Respuesta individual
{ "success": true, "statusCode": 200, "data": { ... }, "timestamp": "..." }

// Respuesta paginada
{ "success": true, "statusCode": 200, "data": [...], "meta": { "page": 1, "limit": 10, "totalItems": 47, "totalPages": 5, "hasNext": true, "hasPrevious": false }, "timestamp": "..." }

// Soft-delete sin contenido
{ "success": true, "statusCode": 200, "data": null, "message": "Plan archivado exitosamente", "timestamp": "..." }
```

---

## 6. Pipeline global de request

Orden de ejecución en cada request:

```
1. CorrelationIdMiddleware     → Asigna UUID al request
2. nestjs-pino middleware      → Inicia log context
3. ValidationPipe (global)     → Valida DTOs → 400 si falla
4. JwtAuthGuard                → Valida JWT → 401 si falla
5. RolesGuard                  → Verifica rol → 403 si falla
6. ResourcePolicyGuard         → Verifica ownership → 403 si falla
7. Temporal Guards             → WeekFrozenGuard, EditWindowGuard → 403 si falla
8. AuditInterceptor (pre)      → Registra inicio del request
9. Controller (thin)           → Delega al service
10. Service                    → Lógica de negocio
11. AuditInterceptor (post)    → Persiste audit log
12. Exception Filters          → Transforman excepciones en respuesta estándar
```

> Para detalle de exception filters → cargar skill `error-handling`
> Para detalle de guards temporales y state machine → cargar skill `design-patterns`

---

## 7. Comunicación entre módulos — ejemplos

```typescript
// Emitir evento desde un service
this.eventEmitter.emit('plan.published', new PlanPublishedEvent(planId, coachId));
```

```typescript
// Escuchar en otro módulo via listener — los listeners SÍ usan try/catch
@OnEvent('plan.published')
async handlePlanPublished(event: PlanPublishedEvent): Promise<void> {
  try {
    await this.notificationService.notifyAthletes(event.planId);
  } catch (error) {
    this.logger.error(`Error al notificar atletas del plan ${event.planId}`, error);
  }
}
```

**Naming de eventos:** ver tabla completa en [references/module-patterns.md](references/module-patterns.md)

---

## 8. Patrones detallados

Para implementación de PrismaService, @CurrentUser(), PaginationDto, services CRUD, inyección de dependencias y registro de módulos en AppModule → ver [references/module-patterns.md](references/module-patterns.md)

---

## 9. tsconfig.build.json

NestJS usa `tsconfig.build.json` para `nest build` y `nest start`. Su `exclude` **REEMPLAZA completamente** el del padre (`tsconfig.json`) — no se fusionan.

```jsonc
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "exclude": [
    "node_modules", "test", "dist", "outputs",
    "**/*spec.ts",
    "prisma.config.ts", "vitest.config.ts", "vitest.config.e2e.ts",
    "scripts"
  ]
}
```

**Reglas:**
- Si agregas una exclusión a `tsconfig.json`, TAMBIÉN debes agregarla a `tsconfig.build.json`
- Todos los archivos `.ts` en la raíz del proyecto DEBEN estar excluidos — si TypeScript los ve, usa `.` como `rootDir` y genera `dist/src/` en vez de `dist/`, rompiendo todos los imports relativos a `generated/prisma/`
- El directorio `outputs/` (archivos del contrato OpenAPI) DEBE estar excluido — contiene TypeScript generado por el Documentador que no es parte del build

**Síntoma si falta una exclusión:** imports como `../../../generated/prisma/index.js` resuelven a `dist/generated/prisma/` (no existe) en vez de `generated/prisma/` (raíz del proyecto)
