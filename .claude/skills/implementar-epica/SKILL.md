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

**Leerlo ANTES de arrancar el Paso 1.** El log no es solo un artefacto de salida: es el único lugar donde viven las decisiones rechazadas, los conflictos que escalaron al humano, las correcciones aplicadas fuera de ciclo y los hallazgos abiertos de épicas anteriores. Nada de eso está en el plan ni en el contrato.

Al leerlo, extraer y tener presente durante todo el flujo:

- **Decisiones ya tomadas por el humano** — no volver a proponer lo que ya se descartó
- **Hallazgos abiertos** (sección `## Hallazgos abiertos`) — si esta épica toca código relacionado con uno, mencionarlo al humano en el CHECKPOINT 2
- **Correcciones triviales aplicadas en épicas previas** — si el mismo error se repite, es señal de que falta una regla, no de que haya que volver a parcharlo

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
2. pnpm run test:e2e 2>&1 (timeout: 300000) — suite e2e contra la DB real
3. pnpm run lint 2>&1 — errores de ESLint reales
4. pnpm run format:check 2>&1 — verificación de formato real (cubre src/ y test/)

Después:
5. Escribe tests faltantes hasta alcanzar targets (80% dominio, 70% adaptadores)
6. Verificación de criterios de aceptación técnicos
7. Detección de vulnerabilidades manual
8. Escaneo de seguridad automatizado (/security-review)
9. Validación OpenAPI con Spectral: pnpm run openapi:validate 2>&1

Sobre el e2e: si falla por conexión a la DB es un problema de entorno — reportarlo como
tal y NO como fallo del código. Si los tests corren y fallan con asserts, es un hallazgo
real. Los endpoints nuevos o modificados de esta épica deben quedar cubiertos en
test/*.e2e-spec.ts: es la única capa que ejercita ValidationPipe, guards y filters.

Todos los valores del reporte YAML deben venir de la salida real de los comandos.
Escribe tu reporte en outputs/reporte_qa.yaml."
```

Esperar a que termine.

**Log:** Agregar fila 2 (qa) con cobertura y estado.

### Paso 2.5 — Verificar los gates (obligatorio)

**El orquestador ejecuta los gates directamente. No se delega esta verificación.**

Ningún agente califica su propio trabajo: el QA escribe los tests, mide la cobertura de esos mismos tests y reporta si alcanzó el target. El Líder Técnico no tiene Bash y no puede contrastar nada. Sin este paso, la decisión final del flujo descansa en números autorreportados.

Ejecutar los seis comandos y **guardar la salida cruda**:

```bash
pnpm run test:cov 2>&1        # timeout 300000
pnpm run test:e2e 2>&1        # timeout 300000 — requiere DB, ver abajo
pnpm run lint 2>&1
pnpm run format:check 2>&1    # cubre src/ y test/ — no usar `npx prettier --check 'src/**/*.ts'`
pnpm run build 2>&1
pnpm run openapi:validate 2>&1  # timeout 300000 — corre build + Spectral
```

Comparar con lo que declara `outputs/reporte_qa.yaml`:

| Campo del reporte | Contrastar contra |
|---|---|
| `linting.eslint` | conteo de errores (no warnings) de `pnpm run lint` |
| `linting.prettier` | salida de `prettier --check` |
| `cobertura.dominio.porcentaje` | tabla de `test:cov` (services) |
| `cobertura.adaptadores.porcentaje` | tabla de `test:cov` (controllers, guards, listeners) |
| `tests.e2e` | conteo de passed/failed de `pnpm run test:e2e` |
| `validacion_openapi` | salida de `pnpm run openapi:validate` |
| `errores_criticos` de tipo `error_de_compilacion` | salida de `pnpm run build` |

**Sobre `openapi:validate`:** hasta el 2026-08-19 este comando no arrancaba — `openapi:export` moría al bootstrapear porque corría con tsx, y esbuild no emite `emitDecoratorMetadata`. Spectral no se ejecutó ni una vez en EPICA-01 ni en EPICA-09 pese a estar en el proceso del QA (hallazgo #8). Ahora corre contra `dist/`, o sea contra el mismo artefacto que se despliega. Se verifica aquí, y no solo en el reporte del QA, por la misma razón que los demás: es la única forma de saber que corrió de verdad.

#### El e2e y su dependencia de la base de datos

`test:e2e` levanta el `AppModule` real contra la DB de `DATABASE_URL`. Es el único gate que puede fallar por el entorno y no por el código, así que hay que distinguir los dos casos antes de culpar a nadie:

| Síntoma en la salida | Qué significa | Qué hacer |
|---|---|---|
| `Can't reach database server`, `MODULE_NOT_FOUND`, error de conexión antes del primer test | Problema de entorno | **Escalar al humano.** No es un fallo del Desarrollador y no se arregla con un ciclo de corrección. El gate queda sin verificar — nunca darlo por aprobado |
| Tests que corren y fallan con asserts (`expected 201, got 400`) | Problema del código o del contrato | Ciclo de corrección normal |

**Nunca omitir este gate porque la DB no esté disponible.** Un e2e que no corre es indistinguible de un e2e que pasa, y esa fue exactamente la causa del hallazgo #4: la suite llevaba rota desde que los DTOs cambiaron de `accepted*` a `accepts*` y nadie lo vio porque el comando no estaba en ningún gate.

**Por qué el e2e no es redundante con `test:cov`:** los unitarios llaman a los services directamente, así que nunca pasan por el `ValidationPipe`, los guards ni los exception filters. Todo lo que vive en el pipeline HTTP —validación de DTOs, orden guard/pipe, envelope de respuesta, formato RFC 9457— solo lo verifica el e2e. Dos bugs legales (consentimientos sin validar, sin puerta de edad) sobrevivieron a dos épicas justamente ahí.

**Si hay discrepancia entre el reporte y la salida real:** el reporte del QA es inválido. Relanzar el QA una vez con la discrepancia explícita en el prompt. Si vuelve a discrepar, **escalar al humano** — es una falla del agente, no del código, y no se resuelve con ciclos de corrección.

**Log:** Agregar fila 2.5 (orquestador) con el resultado de los gates y si el reporte del QA coincidió.

### Paso 3 — Lanzar Líder Técnico

Usar el Task tool para lanzar el Líder Técnico. **Incluir la salida cruda del Paso 2.5 en el prompt** — el LT no tiene Bash y esta es su única fuente verificada:

**Agente: lider-tecnico**
```
Prompt: "Revisa el código y el reporte del QA. Ciclo: [N].

Lee estos archivos:
- outputs/reporte_qa.yaml (reporte del QA)
- src/ (código implementado)
- outputs/plan_de_implementacion.yaml (referencia del contrato)
- outputs/execution-log.md (decisiones previas y hallazgos abiertos)

SALIDA VERIFICADA DE LOS GATES (ejecutada por el orquestador, no por el QA):
--- pnpm run test:cov ---
[pegar salida real]
--- pnpm run test:e2e ---
[pegar salida real]
--- pnpm run lint ---
[pegar salida real]
--- pnpm run format:check ---
[pegar salida real]
--- pnpm run build ---
[pegar salida real]
--- pnpm run openapi:validate ---
[pegar salida real]

Estos números son la fuente de verdad. Si el reporte del QA los contradice,
prevalece esta salida y se documenta la discrepancia en tu revisión.

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

### Paso 4.5 — Correcciones triviales (ruta rápida)

Girar un ciclo completo de tres agentes por un `pnpm run format` es desperdicio. Esta ruta lo evita, pero es **cerrada y verificable** — no queda a criterio del momento.

**Solo aplica si TODOS los rechazos del LT están en esta lista blanca:**

| Permitido | No permitido |
|---|---|
| Errores de Prettier / formato | Cualquier cambio de lógica |
| Imports o variables no usadas | Cobertura por debajo del target |
| Orden de imports | Violaciones de patrón |
| Comentario o typo en un mensaje | Errores de compilación |
| — | Vulnerabilidades de cualquier severidad |
| — | Inconsistencias código↔contrato |

Si **un solo** rechazo cae fuera de la lista blanca, la ruta rápida no aplica: se incrementa el ciclo y vuelve al Paso 1 con el Desarrollador.

**Procedimiento obligatorio (los cuatro pasos, sin omitir ninguno):**

1. Aplicar la corrección (`pnpm run format`, eliminar el import, etc.)
2. **Re-ejecutar los seis gates del Paso 2.5.** Si alguno falla, la ruta rápida se aborta: incrementar ciclo y volver al Paso 1
3. **Reescribir `estado:` en los DOS artefactos** — `outputs/reporte_qa.yaml` y `outputs/revision_codigo.yaml` — a `"APROBADO"`, vaciar `errores_criticos` / `instrucciones_desarrollador`, y agregar en `razonamiento` qué se corrigió y que fue por ruta rápida
4. **Log:** fila con agente `orquestador`, estado `CORRECCION_TRIVIAL`, y el detalle de qué se tocó

> **El paso 3 no es opcional.** Si se omite, el CHECKPOINT 2 se presenta como APROBADO mientras los dos YAML persistidos dicen `RECHAZADO`. Eso ya ocurrió en EPICA-01 y EPICA-09: el commit de `EPICA-09/checkpoint-2` contiene ambos artefactos en estado `RECHAZADO` sobre código aprobado y taggeado. Los artefactos son la salida formal del sistema — si contradicen la realidad, el sistema miente.

**Antes de presentar el CHECKPOINT 2**, verificar siempre que `outputs/reporte_qa.yaml` y `outputs/revision_codigo.yaml` digan ambos `estado: "APROBADO"`. Si alguno dice otra cosa, el flujo no está completo.

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
