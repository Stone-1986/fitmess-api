# Guia de Uso — La Colmena

> Sistema multi-agente para desarrollo de fitmess-api.
> Version: 1.0 — Marzo 2026

---

## Que es La Colmena

La Colmena es un sistema de desarrollo asistido por IA donde 8 agentes especializados trabajan en coordinacion para producir codigo que cumple con un contrato OpenAPI aprobado, pasa gates de cobertura y respeta la legislacion colombiana.

El desarrollador humano actua como director: decide que se construye, aprueba la calidad y opera git.

---

## Comandos disponibles

### Fase 0 — Requerimientos

| Comando | Que hace | Cuando usar |
|---------|----------|-------------|
| `/analizar-requerimiento <archivo>` | Descompone un documento de requisitos en epicas y HUs con criterios Gherkin | Recibiste un documento de especificacion, acta de reunion o requisitos |
| `/refinar-hu <archivo>` | Mejora HUs existentes: narrativas, criterios, validacion INVEST | Tienes HUs escritas que necesitan revision o mejora |

**Ejemplo:**
```
/analizar-requerimiento docs/requisitos-modulo-auth.md
/refinar-hu outputs/epica_input.yaml
```

### Fase 1 — Planificacion

| Comando | Que hace | Cuando usar |
|---------|----------|-------------|
| `/planificar-epica` | Ejecuta Fase 1 completa: Analista + Arquitecto → Documentador → DBA → CHECKPOINT 1 | Tienes una epica YAML validada lista para planificar |
| `/planificar-epica v1.1` | Re-ejecuta Fase 1 tras incorporar feedback del humano | Diste feedback en CHECKPOINT 1 y ya fue incorporado |

### Fase 2 — Implementacion

| Comando | Que hace | Cuando usar |
|---------|----------|-------------|
| `/implementar-epica` | Ejecuta Fase 2 completa: Desarrollador → QA → LT (max 3 ciclos) | CHECKPOINT 1 aprobado y migracion de Prisma aplicada |
| `/implementar-epica ciclo 2` | Re-inicia desde un ciclo especifico | Necesitas retomar la implementacion desde un ciclo particular |

### Standalone

| Comando | Que hace | Cuando usar |
|---------|----------|-------------|
| `/disenar-schema` | Invoca al DBA para trabajo de base de datos | Necesitas modificar el schema fuera del flujo de planificacion |
| `/disenar-schema "tarea"` | Invoca al DBA con instrucciones especificas | Tarea puntual: agregar modelo, revisar indices, etc. |
| `/validar-qa` | Re-ejecuta el QA: tests, cobertura, linting, seguridad | Necesitas re-validar despues de un fix manual sin lanzar toda la cadena |
| `/validar-qa "tarea"` | Re-ejecuta el QA con instrucciones especificas | Tarea puntual: solo cobertura, re-validar un modulo, etc. |
| `/revisar-codigo` | Re-ejecuta el LT: linting, patrones, consistencia | Necesitas re-revisar codigo sin lanzar toda la cadena |
| `/revisar-codigo "tarea"` | Re-ejecuta el LT con instrucciones especificas | Tarea puntual: revisar solo patrones de auth, etc. |
| `/commit` | Crea commits estandarizados con Conventional Commits, auto-staging y tags | Cualquier commit del proyecto — epicas o generales |
| `/commit checkpoint 1` | Commit directo de Checkpoint 1 con staging y tag automaticos | Aprobaste el CHECKPOINT 1 y quieres commitear |
| `/actualizar-docs` | Revisa cambios recientes y propone actualizaciones a CLAUDE.md, rules, skills, memory y guia | Despues de un hito, refactor o cambio estructural |
| `/actualizar-docs "contexto"` | Igual pero con contexto especifico de que cambio | Cuando quieres focalizar la revision |

**Ejemplo:**
```
/disenar-schema "agregar modelo Notification con campos userId, type, message, readAt"
/disenar-schema "revisar indices de la tabla coach_requests"
/validar-qa "re-validar auth despues del fix manual"
/revisar-codigo "revisar solo patrones de auth"
```

---

## Flujo completo paso a paso

### Preparacion

1. **Crear la epica de entrada.** Escribe o genera `outputs/epica_input.yaml` con las HUs. Puedes usar `/analizar-requerimiento` para generarla desde un documento.

2. **Validar la estructura.** Ejecuta:
   ```bash
   pnpm run validate:epica outputs/epica_input.yaml
   ```

### Fase 1 — Planificacion

3. **Lanzar planificacion.** Escribe `/planificar-epica`. El sistema ejecuta automaticamente:
   - Analista de Producto valida funcionalidad y guardrails legales
   - Arquitecto genera plan tecnico con endpoints, guards y eventos
   - Documentador genera contrato OpenAPI (controllers + DTOs)
   - DBA diseña el schema de base de datos

4. **Revisar CHECKPOINT 1.** Recibes un resumen con el trabajo de los 4 agentes. Revisa:
   - `outputs/reporte_validacion_negocio.yaml` — decisiones por HU
   - `outputs/plan_de_implementacion.yaml` — endpoints y arquitectura
   - `outputs/contrato_openapi/` — controllers y DTOs generados
   - `prisma/schema.prisma` — modelos de base de datos

5. **Dar feedback o aprobar.** Dos opciones:
   - **Feedback:** Escribe tus observaciones organizadas por HU. El sistema incorpora los cambios y re-ejecuta lo necesario.
   - **Aprobar:** Commitea y ejecuta la migracion de Prisma:
     ```bash
     /commit checkpoint 1
     ```

6. **Migracion Prisma.** Despues del commit, aplicar la migracion desde la **raiz del proyecto**:
   ```bash
   cd ~/projects/fitmess/fitmess-api
   pnpm prisma migrate dev --name epica-xx-descripcion
   pnpm prisma generate
   ```
   - `migrate dev` crea la migracion SQL y la aplica a la base de datos local
   - `generate` regenera el cliente Prisma con los tipos nuevos (modelos, enums)
   - **IMPORTANTE:** Estos comandos DEBEN ejecutarse desde la raiz del proyecto (donde esta `prisma/schema.prisma`). Si se ejecutan desde otro directorio (ej: `outputs/`), Prisma no encuentra el schema y falla con `Could not find Prisma Schema`

### Fase 2 — Implementacion

7. **Lanzar implementacion.** Escribe `/implementar-epica`. El sistema ejecuta automaticamente:
   - Desarrollador implementa services, completa controllers, registra modules. Verifica compilacion con `tsc --noEmit` antes de entregar
   - QA escribe tests, valida cobertura (80% dominio, 70% adaptadores), verifica compilacion con `pnpm run build`, revisa seguridad
   - Lider Tecnico revisa linting, patrones y consistencia con el contrato

8. **Ciclos de correccion.** Si hay errores, el sistema repite automaticamente (max 3 ciclos). Si llega al ciclo 3 sin resolucion, escala al humano.

9. **Revisar CHECKPOINT 2.** Cuando el LT aprueba, recibes un resumen final.

10. **Commit y push.** Si todo esta bien:
   ```bash
   /commit checkpoint 2
   git push
   ```

---

## Como dar feedback

El feedback se da en **texto libre** despues de cada CHECKPOINT. Recomendaciones:

- **Organizar por HU** para que sea claro que afecta cada observacion
- **Ser especifico** — "falta el campo phoneCountryCode en HU-001" es mejor que "faltan campos"
- **Indicar prioridad** si tienes muchas observaciones
- **Preguntar** si algo no esta claro — el sistema responde antes de re-ejecutar

**Ejemplo de feedback:**
```
HU-001:
1. Falta el campo identificationType en el registro de entrenador
2. El endpoint de busqueda deberia ser POST con body, no GET con query params

HU-003:
1. El atleta en Fase 1 no proporciona datos de salud — remover HEALTH_DATA_CONSENT
```

El sistema incorpora los cambios, re-ejecuta los agentes necesarios y presenta un nuevo CHECKPOINT.

---

## Execution Log

Cada ejecucion genera un archivo `outputs/execution-log.md` que registra paso a paso que hizo cada agente. Utilidad:

- **Seguimiento:** ver en que paso esta el flujo
- **Depuracion:** identificar que agente fallo y por que
- **Mejora continua:** detectar patrones de error recurrentes
- **Onboarding:** un nuevo dev ve como se ejecuto cada epica

---

## Agentes disponibles

| Agente | Rol | Invocado por |
|--------|-----|-------------|
| `business-analyst` | Descompone requisitos en epicas y HUs | `/analizar-requerimiento`, `/refinar-hu` |
| `product-analyst` | Valida HUs contra criterios funcionales y legales | `/planificar-epica` (automatico) |
| `arquitecto` | Genera plan tecnico con endpoints y patrones | `/planificar-epica` (automatico) |
| `documentador` | Genera contrato OpenAPI (controllers + DTOs) | `/planificar-epica` (automatico) |
| `dba` | Diseña schema Prisma (modelos, indices, constraints) | `/planificar-epica` (automatico), `/disenar-schema` |
| `desarrollador` | Implementa codigo contra el contrato aprobado | `/implementar-epica` (automatico) |
| `qa` | Tests + cobertura + seguridad + Spectral | `/implementar-epica` (automatico), `/validar-qa` |
| `lider-tecnico` | Revision de codigo + linting + patrones | `/implementar-epica` (automatico), `/revisar-codigo` |

---

## Archivos clave

| Archivo | Que contiene | Quien lo genera |
|---------|-------------|-----------------|
| `outputs/epica_input.yaml` | Epica con HUs y criterios de aceptacion | Humano o business-analyst |
| `outputs/reporte_validacion_negocio.yaml` | Validacion funcional y legal de cada HU | product-analyst |
| `outputs/plan_de_implementacion.yaml` | Endpoints, guards, eventos, orden de implementacion | arquitecto |
| `outputs/contrato_openapi/` | Controllers con stubs + DTOs con decoradores Swagger | documentador |
| `outputs/reporte_qa.yaml` | Tests, cobertura, vulnerabilidades | qa |
| `outputs/revision_codigo.yaml` | Linting, patrones, instrucciones de correccion | lider-tecnico |
| `outputs/execution-log.md` | Registro paso a paso de la ejecucion | orquestador (automatico) |
| `prisma/schema.prisma` | Modelos de base de datos | dba |

---

## Que hacer si algo falla

| Situacion | Que pasa | Que hacer |
|-----------|----------|-----------|
| Conflicto entre Analista y Arquitecto | El flujo se detiene automaticamente | Revisar ambas posiciones y decidir |
| Error critico en QA | El LT delega correccion al Desarrollador | Esperar — se resuelve automaticamente (max 3 ciclos) |
| Ciclo 3 sin resolucion | El flujo escala al humano | Revisar el reporte de escalamiento con errores persistentes |
| El LT dice que se necesita cambiar el contrato | El flujo se detiene | Re-ejecutar `/planificar-epica` con las correcciones |
| Un agente no puede escribir su output | El orquestador lo escribe | No deberia pasar — todos los agentes tienen Write |
| El codigo no compila (`pnpm run build` falla) | QA lo reporta como error critico de compilacion | El Desarrollador corrige los errores de tipo. Si persiste, revisar `tsconfig.build.json` (exclude reemplaza padre) |
| Tests pasan pero `tsc --noEmit` falla | SWC transpila sin type-checking — los tests ignoran errores de tipo | Corregir los errores de tipo que `tsc` reporta. Los mas comunes: enums locales vs Prisma, casts faltantes, argumentos de mas |
| `dist/src/` nesting (imports rotos en runtime) | Un archivo `.ts` en la raiz del proyecto no esta excluido en `tsconfig.build.json` | Agregar el archivo a `tsconfig.build.json` exclude |
| Variables de entorno no encontradas al iniciar | Nombre en `.env` no coincide con `configService.getOrThrow()` | Verificar `.env.example` como fuente de verdad y sincronizar nombres |
| El schema no tiene los modelos necesarios | `/implementar-epica` no inicia | Ejecutar `/disenar-schema` o re-ejecutar `/planificar-epica` |

---

## Gates automaticos

El proyecto tiene 4 niveles de verificacion de compilacion:

| Nivel | Quien | Comando | Cuando |
|-------|-------|---------|--------|
| 1 | Documentador | `npx tsc --noEmit` | Al generar stubs del contrato (Fase 1) |
| 2 | Desarrollador | `npx tsc --noEmit` | Antes de entregar implementacion (Fase 2) |
| 3 | QA | `pnpm run build` | Como paso de validacion (Fase 2) |
| 4 | Hook pre-commit | `npx tsc --noEmit` | Antes de cada `git commit` del humano |

**¿Por que tantos niveles?** Vitest usa SWC para transpilar, que NO verifica tipos. Los tests pueden pasar aunque el codigo tenga errores de tipo. Solo `tsc` (via `tsc --noEmit` o `pnpm run build`) verifica tipos realmente.

### El hook pre-commit y la suite e2e

Ademas de lint-staged y `tsc --noEmit`, el hook corre `pnpm run test:e2e` **cuando el commit toca** `src/`, `test/`, `prisma/`, `package.json` o `vitest.config*`. Un commit de documentacion no lo dispara.

Necesita la base de datos levantada. Si no lo esta, el hook **no bloquea el commit**: imprime una advertencia de que el gate quedo sin verificar y sigue. La razon es practica — bloquear obligaria a usar `git commit --no-verify`, que apaga tambien lint-staged y `tsc`. Si ves esa advertencia, levanta la DB y corre `pnpm run test:e2e` antes de abrir el PR.

Si los tests corren y fallan de verdad, el commit **si** se bloquea.

**El hook tarda mas de 2 minutos** cuando dispara la suite e2e — son ~200 tests contra la base real, mas lint-staged y `tsc`. Si vas a commitear codigo, dale tiempo y no lo interrumpas.

Si el commit se corta a mitad del hook (timeout, Ctrl-C), **no queda nada roto**: lint-staged restaura el estado original y los archivos siguen staged. Verificalo con `git log --oneline -1` (el commit no se creo), `git status --short` (los archivos siguen ahi) y `git stash list` (vacio — si quedara un stash de lint-staged, ese seria el respaldo a recuperar). Basta reintentar el mismo `git commit`.

Un commit que solo toca `outputs/` o documentacion no dispara la e2e, asi que es rapido. Ahi `--no-verify` no aporta nada y conviene no usarlo.

---

## Resumen rapido

```
/analizar-requerimiento documento.md     → Genera epica YAML
pnpm run validate:epica                  → Valida estructura
/planificar-epica                        → Fase 1 (4 agentes → CHECKPOINT 1)
pnpm prisma migrate dev                  → Aplica migracion
/implementar-epica                       → Fase 2 (3 agentes × max 3 ciclos → CHECKPOINT 2)
/validar-qa                              → Re-validar QA standalone (tests, cobertura, seguridad)
/revisar-codigo                          → Re-revisar codigo standalone (linting, patrones, contrato)
/commit                                  → Commit estandarizado (Conventional Commits + tags)
/actualizar-docs                         → Revisa cambios y propone actualizaciones a docs
git push                                 → Deploy
```
