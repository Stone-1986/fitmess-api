---
name: implementar-epica
description: Orquesta la Fase 2 del flujo de desarrollo — lanza la Cadena de Implementación (Desarrollador → QA → Líder Técnico) con gestión automática de hasta 3 ciclos de corrección. Usar después del CHECKPOINT 1 aprobado. Requiere que existan los outputs de la Fase 1 en `outputs/`.
---

# /implementar-epica $ARGUMENTS

Orquesta la Fase 2 completa de la Cadena de Implementación.

## Uso

```
/implementar-epica
/implementar-epica ciclo 2       # Re-iniciar desde un ciclo específico
```

## Prerequisitos

Antes de iniciar, verificar que existen los outputs de la Fase 1:

1. `outputs/plan_de_implementacion.yaml` — plan aprobado
2. `outputs/reporte_validacion_negocio.yaml` — validación aprobada
3. `outputs/contrato_openapi/` — contrato OpenAPI generado
4. El schema de Prisma (`prisma/schema.prisma`) debe incluir los modelos necesarios (idealmente el DBA ya actualizó el schema y el humano ejecutó la migración)
5. `outputs/execution-log.md` — debe existir (creado por `/planificar-epica`)

Si falta algún prerequisito, informar al humano y no continuar.

## Execution Log

Continuar escribiendo en `outputs/execution-log.md` (creado en Fase 1).

**Al inicio de cada ciclo de Fase 2:**

```markdown
## Fase 2 — Implementación (ciclo [N])

| # | Paso | Agente | Estado | Output | Notas |
|---|------|--------|--------|--------|-------|
```

**Después de cada paso**, agregar una fila con el resultado. Los estados posibles son: `OK`, `FAIL`, `RECHAZADO`, `APROBADO`, `ESCALADO`.

## Flujo de Ejecución

### Paso 1 — Lanzar Desarrollador

Usar el Task tool para lanzar el Desarrollador:

**Agente: desarrollador**
```
Prompt: "Implementa la EPICA según el plan y contrato aprobados.

Lee estos archivos:
- outputs/plan_de_implementacion.yaml
- outputs/reporte_validacion_negocio.yaml
- outputs/contrato_openapi/ (controllers y DTOs)
[Solo en ciclo 2+]: - outputs/revision_codigo.yaml (instrucciones del LT)

Sigue el orden_de_implementacion del plan. Implementa services, completa controller stubs y registra modules."
```

Esperar a que termine.

**Log:** Agregar fila 1 (desarrollador) con resumen de lo implementado.

### Paso 2 — Lanzar QA

Usar el Task tool para lanzar el QA:

**Agente: qa**
```
Prompt: "Valida la implementación del Desarrollador. Ciclo: [N].

Lee estos archivos:
- src/ (código implementado)
- outputs/plan_de_implementacion.yaml (criterios de aceptación)
- outputs/reporte_validacion_negocio.yaml (condiciones legales)

IMPORTANTE: Tienes acceso a Bash. DEBES ejecutar todos los comandos — NUNCA escribir placeholders como PENDIENTE_EJECUCION_REAL.

Ejecuta estos comandos con Bash (obligatorio):
1. pnpm run test:cov 2>&1 (timeout: 300000) — tests + cobertura real
2. pnpm run lint 2>&1 — errores de ESLint reales
3. npx prettier --check 'src/**/*.ts' 2>&1 — verificación de formato real

Después:
4. Escribe tests faltantes hasta alcanzar targets (80% dominio, 70% adaptadores)
5. Verificación de criterios de aceptación técnicos
6. Detección de vulnerabilidades manual
7. Escaneo de seguridad automatizado (/security-review)
8. Validación OpenAPI con Spectral: pnpm run openapi:validate 2>&1

Todos los valores del reporte YAML deben venir de la salida real de los comandos.
Escribe tu reporte en outputs/reporte_qa.yaml."
```

Esperar a que termine.

**Log:** Agregar fila 2 (qa) con cobertura y estado.

### Paso 3 — Lanzar Líder Técnico

Usar el Task tool para lanzar el Líder Técnico:

**Agente: lider-tecnico**
```
Prompt: "Revisa el código y el reporte del QA. Ciclo: [N].

Lee estos archivos:
- outputs/reporte_qa.yaml (reporte del QA)
- src/ (código implementado)
- outputs/plan_de_implementacion.yaml (referencia del contrato)

Analiza linting, cobertura, patrones, consistencia código↔contrato y vulnerabilidades.
Escribe tu revisión en outputs/revision_codigo.yaml."
```

Esperar a que termine.

**Log:** Agregar fila 3 (lider-tecnico) con estado y errores encontrados.

### Paso 4 — Evaluar resultado

Leer `outputs/revision_codigo.yaml` y evaluar:

**Si `estado: "APROBADO"`:**
- Presentar CHECKPOINT 2 al humano (ver formato abajo)
- Flujo completado
- **Log:** Agregar fila 4 con estado APROBADO

**Si `estado: "RECHAZADO"` y ciclo actual < 3:**
- Informar al humano los errores encontrados
- Incrementar ciclo
- Volver al Paso 1 (el Desarrollador leerá `revision_codigo.yaml` con las instrucciones)
- **Log:** Agregar fila 4 con estado RECHAZADO y motivo. Agregar nueva sección para el siguiente ciclo.

**Si `estado: "RECHAZADO"` y ciclo actual = 3:**
- Presentar reporte de escalamiento al humano
- Flujo detenido — el humano decide cómo proceder
- **Log:** Agregar fila 4 con estado ESCALADO

**Si `requiere_modificar_contrato: true` o `requiere_modificar_plan: true`:**
- DETENER el flujo inmediatamente, sin importar el ciclo
- Informar al humano que se requieren cambios en el contrato o plan
- El humano debe re-ejecutar `/planificar-epica` con las correcciones
- **Log:** Agregar fila 4 con estado DETENIDO — requiere cambios en contrato/plan

## Gestión de Ciclos

```
Ciclo 1: Desarrollador → QA → LT → ¿APROBADO?
Ciclo 2: Desarrollador (con instrucciones LT) → QA → LT → ¿APROBADO?
Ciclo 3: Desarrollador (con instrucciones LT) → QA → LT → ¿APROBADO? / ESCALAR
```

Máximo 3 ciclos. NUNCA intentar un ciclo 4.

Entre ciclos, los reportes del ciclo anterior quedan como referencia. El campo `razonamiento` es obligatorio desde el ciclo 2 en todos los outputs (plan, reporte QA, revisión LT).

## CHECKPOINT 2 — Formato de presentación

```
## CHECKPOINT 2 — [Épica ID]: [Título] — Implementación Completa

### Resumen
- Ciclos ejecutados: [N]
- Estado final: APROBADO

### Código implementado
- Services: [lista]
- Controllers: [lista]
- Guards: [lista, si aplica]
- Listeners: [lista, si aplica]

### QA
- Tests unitarios: [cantidad] specs
- Tests e2e: [cantidad] specs
- Cobertura dominio: [X]% (target: 80%)
- Cobertura adaptadores: [X]% (target: 70%)
- Vulnerabilidades: [Ninguna / Detalle]
- Validación OpenAPI: [PASS / Detalle]

### Líder Técnico
- Linting: PASS
- Patrones: Sin violaciones
- Consistencia contrato: OK

> El código está listo para revisión final y git push.
```

## Outputs del Flujo

Al completar la Fase 2, además de los archivos de Fase 1:

```
outputs/
  reporte_qa.yaml                   ← QA (último ciclo)
  revision_codigo.yaml              ← Líder Técnico (último ciclo)
  execution-log.md                  ← Log completo (Fase 1 + Fase 2)
src/
  modules/[module]/                 ← Código implementado
    [module].service.ts
    [module].controller.ts
    [module].module.ts
    dto/
    guards/ (si aplica)
    listeners/ (si aplica)
    *.spec.ts                       ← Tests unitarios
test/
  [module].e2e-spec.ts              ← Tests e2e
```
