---
name: planificar-epica
description: Orquesta la Fase 1 del flujo de desarrollo — lanza el Agent Team de Planificación (Analista de Producto + Arquitecto en paralelo, luego Documentador y DBA en secuencia) y presenta el CHECKPOINT 1 al humano. Usar cuando se necesite planificar una épica completa antes de implementar. Requiere que exista `outputs/epica_input.yaml` validado.
---

# /planificar-epica $ARGUMENTS

Orquesta la Fase 1 completa del Agent Team de Planificación.

## Uso

```
/planificar-epica
/planificar-epica v1.1          # Re-ejecutar con versión (tras feedback del humano)
```

## Prerequisitos

Antes de iniciar, verificar:

1. **`outputs/epica_input.yaml` existe** y está validado (`pnpm run validate:epica`)
2. Si es una re-ejecución (argumento de versión), verificar que el feedback del humano ya fue incorporado en los archivos de `outputs/`

Si el prerequisito no se cumple, informar al humano y no continuar.

## Execution Log

Al inicio del flujo, crear o actualizar `outputs/execution-log.md`. Este archivo registra cada paso para trazabilidad.

**Al inicio de la Fase 1:**

```markdown
# Execution Log — [EPICA-ID]: [Título]

## Fase 1 — Planificación (v[N])

| # | Paso | Agente | Estado | Output | Notas |
|---|------|--------|--------|--------|-------|
```

**Después de cada paso**, agregar una fila con el resultado. Los estados posibles son: `OK`, `FAIL`, `DETENIDO`, `FEEDBACK`.

**Importante:** Si es una re-ejecución (v1.1, v1.2...), agregar una nueva sección al log — NO sobreescribir la anterior. Así queda el historial completo de iteraciones.

## Versionado con Git

Antes de re-ejecutar tras feedback del humano, recordarle que haga commit de la versión actual:

> Antes de incorporar feedback, se recomienda hacer commit para preservar la versión actual:
> `git add outputs/ prisma/schema.prisma && git commit -m "EPICA-XX: CHECKPOINT 1 vN.N"`

## Flujo de Ejecución

### Paso 1 — Lanzar Analista de Producto y Arquitecto en paralelo

Usar el Task tool para lanzar ambos agentes **simultáneamente** como tareas en background:

**Agente: product-analyst**
```
Prompt: "Lee outputs/epica_input.yaml y ejecuta tu proceso completo de validación.
Escribe tu reporte en outputs/reporte_validacion_negocio.yaml."
```

**Agente: arquitecto**
```
Prompt: "Lee outputs/epica_input.yaml y ejecuta tu proceso completo de planificación.
Escribe tu plan en outputs/plan_de_implementacion.yaml."
```

Esperar a que ambos terminen antes de continuar.

**Log:** Agregar filas 1a (product-analyst) y 1b (arquitecto) al execution log.

### Paso 2 — Verificar conflictos

Leer ambos outputs:
- `outputs/reporte_validacion_negocio.yaml`
- `outputs/plan_de_implementacion.yaml`

Verificar:
- [ ] ¿El reporte tiene `escalamiento_requerido: true`? → Informar al humano y DETENER
- [ ] ¿Hay HUs rechazadas por el Analista que el Arquitecto planificó? → Informar al humano y DETENER
- [ ] ¿El Arquitecto tiene preguntas sin resolver? → Informar al humano y DETENER

Si no hay conflictos, continuar.

**Log:** Agregar fila 2 (verificar conflictos) con resultado.

### Paso 3 — Lanzar Documentador

Usar el Task tool para lanzar el Documentador:

**Agente: documentador**
```
Prompt: "Lee outputs/plan_de_implementacion.yaml y outputs/reporte_validacion_negocio.yaml.
Genera el contrato OpenAPI en outputs/contrato_openapi/.
Ejecuta tu checklist de consistencia plan↔contrato antes de cerrar."
```

Esperar a que termine.

**Log:** Agregar fila 3 (documentador) con cantidad de archivos generados.

### Paso 4 — Lanzar DBA

Usar el Task tool para lanzar el DBA:

**Agente: dba**
```
Prompt: "Lee outputs/plan_de_implementacion.yaml y outputs/reporte_validacion_negocio.yaml.
Lee prisma/schema.prisma para conocer el estado actual.
Diseña o actualiza los modelos, enums, índices y constraints necesarios para la épica.
Escribe los cambios en prisma/schema.prisma."
```

Esperar a que termine.

**Log:** Agregar fila 4 (dba) con cantidad de modelos y enums.

### Paso 5 — Spot-check del contrato y schema

**Contrato OpenAPI:**
- Leer al menos 2 DTOs de entrada y verificar que tienen decoradores `@ApiProperty` y validadores
- Leer al menos 1 controller y verificar que tiene todos los endpoints del plan
- Verificar que no hay campos internos expuestos en DTOs de respuesta

**Schema Prisma:**
- Verificar que los modelos del plan tienen su definición en el schema
- Verificar que los campos `@unique` corresponden a las restricciones de negocio
- Verificar que las tablas inmutables (legal_acceptances) no tienen `updatedAt`

Si hay problemas, documentarlos para el CHECKPOINT.

**Log:** Agregar fila 5 (spot-check) con resultado.

### Paso 6 — Presentar CHECKPOINT 1

Presentar al humano un resumen estructurado:

```
## CHECKPOINT 1 — [Épica ID]: [Título]

### Analista de Producto
- HU-XXX: [DECISIÓN] — [observación clave]
- ...

### Arquitecto
- Módulos: [lista]
- Endpoints: [cantidad] ([lista resumida])
- Decisiones clave: [1-3 principales]

### Documentador
- Archivos generados: [cantidad]
  - Controllers: [lista]
  - DTOs: [lista]
  - Enums: [lista]

### DBA
- Modelos: [nuevos / modificados]
- Enums: [lista]
- Índices: [cantidad y justificación]
- Constraints únicos: [lista]

### Verificaciones
- Conflictos Analista↔Arquitecto: [Ninguno / Detalle]
- Spot-check contrato: [OK / Hallazgos]
- Spot-check schema: [OK / Hallazgos]

> Revisa los archivos en outputs/ y prisma/schema.prisma.
> Comparte tu feedback. Si apruebas el schema, ejecuta:
>   pnpm prisma migrate dev --name [epica-id]-[descripcion]
>   pnpm prisma generate
```

**Log:** Agregar fila 6 (CHECKPOINT 1) con estado FEEDBACK o APROBADO.

### Paso 7 — Incorporar feedback (si aplica)

Si el humano proporciona feedback:
1. Recordar al humano que haga commit de la versión actual
2. Actualizar `outputs/epica_input.yaml` con las correcciones
3. Actualizar `outputs/plan_de_implementacion.yaml` si hay cambios técnicos
4. Actualizar `outputs/reporte_validacion_negocio.yaml` si hay cambios funcionales
5. Eliminar `outputs/contrato_openapi/` anterior
6. Re-ejecutar los pasos afectados:
   - Cambios estructurales (HUs, criterios) → desde Paso 1
   - Cambios técnicos (endpoints, DTOs) → desde Paso 3 (Documentador)
   - Cambios solo de schema → desde Paso 4 (DBA)
7. Presentar nuevo CHECKPOINT 1 con versión incrementada

**Log:** Agregar nueva sección "Fase 1 — Planificación (v[N+1] — post-feedback)" al execution log.

## Outputs del Flujo

Al completar la Fase 1, los siguientes archivos quedan listos:

```
outputs/
  epica_input.yaml                  ← Input validado
  reporte_validacion_negocio.yaml   ← Analista de Producto
  plan_de_implementacion.yaml       ← Arquitecto
  contrato_openapi/                 ← Documentador
    *.controller.ts
    dto/*.dto.ts
    enums/*.enum.ts
    README-contrato.md
  execution-log.md                  ← Log de ejecución (acumulativo)
prisma/
  schema.prisma                     ← DBA (actualizado)
```

Estos archivos son la entrada de la Fase 2 (`/implementar-epica`).
Antes de pasar a Fase 2, el humano debe ejecutar la migración de Prisma.
