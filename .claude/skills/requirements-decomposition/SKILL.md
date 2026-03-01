---
name: requirements-decomposition
description: Transforma documentos de requerimientos en Épicas, Features e Historias de Usuario con criterios de aceptación Gherkin. Se activa cuando se recibe un documento de especificación, cuando se necesita crear o refinar historias de usuario, o cuando se mencionan requerimientos, HUs, épicas, criterios de aceptación, historias, backlog, o análisis funcional. Agnóstico al dominio — se adapta a cualquier sector.
---

# Requirements Decomposition

Skill para transformar documentos de requerimientos crudos en artefactos ágiles
estructurados: Épicas → Features → Historias de Usuario con criterios Gherkin.

## Workflow Principal

Ejecutar estos pasos en orden. No saltar pasos. Si falta información para avanzar,
preguntar al usuario antes de continuar.

**Nota sobre referencias:** Este skill referencia archivos en la carpeta `references/`
ubicada junto a este archivo. Para localizar los archivos de referencia, usar primero
la herramienta **Glob** con el patrón `**/requirements-decomposition/references/<nombre-archivo>`
y luego **Read** para leer el archivo encontrado.

**Documentos grandes:** Si el documento de entrada supera las ~80 páginas o se detecta
que el contexto es insuficiente para procesarlo completo, dividir el análisis por
secciones o capítulos. Procesar cada sección como un sub-análisis, mantener un registro
acumulado de actores, reglas de negocio y glosario, y consolidar al final.

### Paso 0: Descubrimiento de Contexto

Antes de analizar, extraer del documento y confirmar con el usuario:

1. **Dominio del proyecto** — ¿De qué trata? (salud, finanzas, logística, educación...)
2. **Actores/Roles** — ¿Quiénes interactúan con el sistema? Listar cada rol encontrado.
3. **Objetivos de negocio** — ¿Qué problema resuelve? ¿Qué valor genera?
4. **Glosario preliminar** — Términos específicos del documento que podrían ser ambiguos.
5. **Sistemas mencionados** — ¿Se mencionan sistemas existentes o integraciones?
6. **Restricciones regulatorias** — ¿Se mencionan normativas, compliance, regulaciones?

Presentar estos hallazgos al usuario y preguntar:
- "¿El contexto es correcto?"
- "¿Falta algún actor o rol?"
- "¿Hay algún término que deba entender de forma especial?"

Solo avanzar al Paso 1 cuando el usuario confirme.

**Si el usuario no puede confirmar** (dice "no sé", "no tengo esa info", o similar):
- Documentar los puntos sin confirmar como **supuestos preliminares**
- Marcarlos con el prefijo `[SUPUESTO]` para visibilidad
- Continuar con esos supuestos pero revisarlos en el Paso 2 (Resolución de Gaps)
- No bloquear el avance por información no crítica

Si el usuario proporciona contexto inline junto al documento (por ejemplo, como
argumento del comando), validar ese contexto pero no repetir toda la fase de
descubrimiento — ir directamente a confirmación rápida.

### Paso 1: Análisis del Documento

Con el contexto confirmado, analizar el documento buscando:

**Extraer:**
- Objetivos principales y secundarios
- Reglas de negocio explícitas (las que el documento define claramente)
- Reglas de negocio implícitas (las que se deducen pero no están escritas)
- Flujos de trabajo descritos
- Datos mencionados (qué información se maneja, sin definir estructura técnica)
- Condiciones y excepciones

**Clasificar cada hallazgo** como:
- ✅ Claro — Suficiente información para generar HUs
- ⚠️ Ambiguo — Necesita clarificación antes de continuar
- ❌ Faltante — Información no proporcionada que es necesaria

### Paso 2: Resolución de Gaps

Presentar al usuario SOLO los ítems marcados como ⚠️ Ambiguo y ❌ Faltante.

Agrupar las preguntas por categoría. Localizar el archivo con **Glob** (`**/requirements-decomposition/references/refinement-checklist.md`)
y leerlo con **Read** para aplicar las preguntas típicas por categoría.
Priorizar y hacer máximo 3-5 preguntas por turno, empezando por las más críticas
(las que bloquean la descomposición).

Iterar hasta que todos los ítems críticos estén en ✅ Claro.
Los ítems no críticos pueden quedarse como supuestos documentados.

**Si el usuario no tiene respuesta** para una pregunta:
- **Bloqueante**: Documentar como `[PENDIENTE-BLOQUEANTE]` y no generar HUs que dependan de esa info
- **Importante**: Documentar como `[SUPUESTO]` con la mejor inferencia y continuar
- **Deseable**: Omitir y anotar en la sección de Supuestos del entregable final

### Paso 3: Descomposición en Épicas y Features

Con la información clara, descomponer:

**Épica** = Un objetivo de negocio grande que agrupa funcionalidad relacionada.
Formato:
```
ÉPICA-[ID]: [Nombre descriptivo]
Objetivo: [Qué valor de negocio entrega]
Actores involucrados: [Lista de roles]
```

**Feature** = Una capacidad funcional dentro de una épica.
Formato:
```
FEAT-[ID]: [Nombre descriptivo]
Épica padre: ÉPICA-[ID]
Descripción: [Qué permite hacer esta feature]
```

Presentar la estructura de Épicas y Features al usuario ANTES de generar las HUs.
Preguntar: "¿La descomposición tiene sentido? ¿Falta o sobra algo?"

### Paso 4: Generación de Historias de Usuario

Para cada Feature, generar las HUs. Localizar el archivo con **Glob** (`**/requirements-decomposition/references/templates.md`)
y leerlo con **Read** para seguir los templates definidos ahí.

Cada HU debe incluir:
1. **ID y título**
2. **Narrativa** en formato "Como [rol] quiero [acción] para [beneficio]"
3. **Criterios de aceptación** en formato Gherkin (Dado/Cuando/Entonces)
4. **Reglas de negocio** aplicables (solo las funcionales)
5. **Dependencias** con otras HUs si las hay
6. **Notas y supuestos** si quedaron puntos no confirmados

Importante:
- Los criterios de aceptación son FUNCIONALES, no técnicos
- Cada criterio Gherkin debe ser verificable por un usuario de negocio
- No incluir: "la API debe responder en menos de 200ms" ✗
- Sí incluir: "el usuario ve un mensaje de confirmación al guardar" ✓

### Paso 5: Validación INVEST

Revisar cada HU contra los criterios INVEST. Localizar el archivo con **Glob** (`**/requirements-decomposition/references/quality-criteria.md`)
y leerlo con **Read** para aplicar la definición completa.

Si una HU no cumple algún criterio:
- **No es Independiente** → Evaluar si se puede separar la dependencia
- **No es Pequeña** → Dividir en HUs más granulares
- **No es Testeable** → Reescribir los criterios de aceptación

Marcar en cada HU:
- ✅ Cumple INVEST
- ⚠️ Cumple parcialmente (indicar qué criterio falla y por qué es aceptable)
- ❌ No cumple (indicar qué criterio falla y la acción correctiva)

**Cuando una HU recibe ❌:**
1. Intentar corregirla (reescribir, dividir, o reformular)
2. Si después de corregir sigue sin cumplir, presentar al usuario con la explicación
3. El usuario decide: reformular el requerimiento, fusionar con otra HU, o aceptar
   la excepción documentada
4. Nunca incluir una HU con ❌ en el entregable final sin aprobación del usuario

### Paso 6: Presentación y Review

Presentar el entregable completo con esta estructura:

```
## Resumen Ejecutivo
- Total: X Épicas, Y Features, Z Historias de Usuario
- Dominio: [tipo de proyecto]
- Actores: [lista]

## Mapa de Descomposición
ÉPICA-01: [nombre]
  ├── FEAT-01: [nombre]
  │   ├── HU-001: [título]
  │   └── HU-002: [título]
  └── FEAT-02: [nombre]
      └── HU-003: [título]

## Detalle de Historias de Usuario
[Cada HU con su detalle completo]

## Supuestos y Pendientes
[Ítems que quedaron sin confirmar]

## Dependencias entre HUs
[Mapa de dependencias si existen]
```

Preguntar: "¿Necesitas ajustar algo? Puedo modificar, dividir, fusionar o
eliminar cualquier historia. ¿Quieres que priorice las HUs?"

### Paso 6b: Priorización (opcional)

Solo ejecutar si el usuario lo solicita. Proponer priorización usando MoSCoW:

| Prioridad | Significado | Criterio |
|-----------|-------------|----------|
| **Must** | Imprescindible | Sin esto el sistema no cumple su objetivo principal |
| **Should** | Importante | Alto valor pero el sistema funciona sin ello en primera versión |
| **Could** | Deseable | Mejora la experiencia pero no es crítico |
| **Won't (por ahora)** | Descartado para este alcance | Se documenta para futuras iteraciones |

Presentar una tabla resumen con la priorización sugerida y pedir confirmación.

---

## Workflow de Refinamiento (HUs existentes)

Cuando el usuario proporciona HUs ya existentes para refinar:

### Paso R1: Lectura y Diagnóstico

1. Usar la herramienta **Read** para leer las HUs proporcionadas
2. Localizar con **Glob** (`**/requirements-decomposition/references/quality-criteria.md` y `**/requirements-decomposition/references/refinement-checklist.md`) y leer con **Read** ambos archivos
3. Evaluar cada HU contra:
   - Criterios INVEST (marcar ✅/⚠️/❌ por cada criterio)
   - Calidad del Gherkin (según antipatrones documentados)
   - Completitud (reglas de negocio, dependencias, supuestos)

### Paso R2: Clasificación de Problemas

Agrupar los hallazgos por tipo y severidad:

| Tipo | Acción |
|------|--------|
| **Narrativa débil** | Reescribir con rol, acción y beneficio claros |
| **Gherkin ausente o vago** | Generar o mejorar criterios de aceptación |
| **HU demasiado grande** | Proponer división con estrategia (ver guía en quality-criteria) |
| **Falla INVEST** | Proponer corrección específica por criterio |
| **Reglas implícitas** | Extraer y hacer explícitas |
| **Dependencias ocultas** | Identificar, documentar, evaluar si se pueden eliminar |
| **Duplicación/solapamiento** | Señalar HUs que se solapan y proponer consolidación |

### Paso R3: Presentación de Diagnóstico

Presentar al usuario:
- Resumen: cuántas HUs revisadas, cuántas con problemas, distribución por tipo
- Tabla de hallazgos por HU (ID, problema, severidad, acción propuesta)
- Preguntar: "¿Quieres que corrija todas, solo las críticas, o HUs específicas?"

### Paso R4: Corrección

Para cada HU a corregir:
1. Mostrar la versión original
2. Mostrar la versión corregida con los cambios resaltados
3. Explicar brevemente qué se cambió y por qué

Si una HU necesita **dividirse**:
- Proponer las nuevas HUs resultantes con IDs provisionales
- Explicar la estrategia de división usada
- Pedir confirmación antes de generar el detalle completo

Si hay HUs que se **solapan**:
- Mostrar qué se repite entre ellas
- Proponer consolidación: qué HU absorbe a cuál
- Pedir confirmación

### Paso R5: Entregable de Refinamiento

Generar el archivo con la estructura definida en el skill `refinar-hu`,
incluyendo tabla comparativa (original → refinada) y registro de cambios.

Preguntar: "¿Necesitas ajustar algo de las correcciones?"

---

## Convenciones de Nomenclatura

| Artefacto | Patrón | Ejemplo |
|-----------|--------|---------|
| Épica | ÉPICA-[##] | ÉPICA-01 |
| Feature | FEAT-[##] | FEAT-03 |
| Historia de Usuario | HU-[###] | HU-015 |
| Criterio de Aceptación | CA-[HU]-[#] | CA-015-3 |

La numeración es secuencial dentro de cada documento. Si el usuario tiene su propia
convención de IDs, adoptarla.

---

## Fuera de Alcance

Este skill NO realiza:
- Diseño técnico, arquitectura, modelado de datos ni diagramas UML
- Estimación en horas, puntos de historia ni story points
- Creación de tareas técnicas (spikes, deuda técnica, CI/CD)
- Sugerencias de tecnologías, frameworks, herramientas o plataformas
- Pruebas de software, scripts de test ni automatización QA
- Gestión de proyecto (cronogramas, sprints, velocidad del equipo)
