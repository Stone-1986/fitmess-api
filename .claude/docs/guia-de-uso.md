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

**Ejemplo:**
```
/disenar-schema "agregar modelo Notification con campos userId, type, message, readAt"
/disenar-schema "revisar indices de la tabla coach_requests"
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
   - **Aprobar:** Ejecuta la migracion de Prisma:
     ```bash
     git add outputs/ prisma/schema.prisma && git commit -m "EPICA-XX: CHECKPOINT 1 aprobado"
     pnpm prisma migrate dev --name epica-xx-descripcion
     pnpm prisma generate
     ```

### Fase 2 — Implementacion

6. **Lanzar implementacion.** Escribe `/implementar-epica`. El sistema ejecuta automaticamente:
   - Desarrollador implementa services, completa controllers, registra modules
   - QA escribe tests, valida cobertura (80% dominio, 70% adaptadores), revisa seguridad
   - Lider Tecnico revisa linting, patrones y consistencia con el contrato

7. **Ciclos de correccion.** Si hay errores, el sistema repite automaticamente (max 3 ciclos). Si llega al ciclo 3 sin resolucion, escala al humano.

8. **Revisar CHECKPOINT 2.** Cuando el LT aprueba, recibes un resumen final.

9. **Git push.** Si todo esta bien:
   ```bash
   git add src/ test/ outputs/ && git commit -m "EPICA-XX: implementacion completa"
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
| `qa` | Tests + cobertura + seguridad + Spectral | `/implementar-epica` (automatico) |
| `lider-tecnico` | Revision de codigo + linting + patrones | `/implementar-epica` (automatico) |

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
| El schema no tiene los modelos necesarios | `/implementar-epica` no inicia | Ejecutar `/disenar-schema` o re-ejecutar `/planificar-epica` |

---

## Resumen rapido

```
/analizar-requerimiento documento.md     → Genera epica YAML
pnpm run validate:epica                  → Valida estructura
/planificar-epica                        → Fase 1 (4 agentes → CHECKPOINT 1)
pnpm prisma migrate dev                  → Aplica migracion
/implementar-epica                       → Fase 2 (3 agentes × max 3 ciclos → CHECKPOINT 2)
git push                                 → Deploy
```
