# Business Analyst Agent — Documentacion Funcional

## Descripcion General

Agente de Claude Code que actua como Analista de Negocio senior. Transforma documentos
de requerimientos crudos en artefactos agiles estructurados y trazables. Es agnostico
al dominio: se adapta al vocabulario y reglas de negocio de cualquier sector
(salud, finanzas, logistica, educacion, gobierno, etc.).

Todo su output es **funcional, nunca tecnico**. No menciona arquitectura, base de datos,
APIs ni stack tecnologico. Las decisiones tecnicas quedan para una etapa posterior.

---

## Comandos Disponibles

El agente expone dos comandos (skills) invocables desde Claude Code:

| Comando | Proposito |
|---------|-----------|
| `/analizar-requerimiento` | Analisis completo de un documento de requerimientos |
| `/refinar-hu` | Refinamiento de Historias de Usuario ya existentes |

---

## Comando: `/analizar-requerimiento`

### Firma

```
/analizar-requerimiento <archivo> [contexto]
```

### Parametros

| Parametro | Requerido | Descripcion |
|-----------|-----------|-------------|
| `archivo` | Si | Ruta al archivo de requerimientos. Formatos: `.txt`, `.md`, `.pdf` |
| `contexto` | No | Texto libre con informacion previa del proyecto (dominio, actores, restricciones). Si se proporciona, el agente salta la fase de descubrimiento y va directo a confirmacion rapida |

### Entradas soportadas

- **Un archivo:** Analisis estandar de un solo documento
- **Multiples archivos:** Separados por espacio o coma. El agente consolida la informacion, detecta contradicciones entre documentos y pregunta cual prevalece

### Ejemplos de invocacion

```
# Analisis basico
/analizar-requerimiento requirements.txt

# Con contexto para saltar descubrimiento
/analizar-requerimiento specs/modulo-ventas.txt "ERP para distribuidora, actores: vendedor, supervisor, almacenista"

# Desde un acta de reunion
/analizar-requerimiento docs/acta-reunion.md

# Multiples documentos
/analizar-requerimiento doc1.txt doc2.md
```

### Workflow de ejecucion

El comando ejecuta 7 pasos secuenciales. Cada paso requiere confirmacion del usuario
antes de avanzar al siguiente.

```
Paso 0: Descubrimiento de Contexto
  │  Extrae: dominio, actores, objetivos, glosario, sistemas, regulaciones
  │  Pregunta al usuario si el contexto es correcto
  ▼
Paso 1: Analisis del Documento
  │  Extrae: objetivos, reglas de negocio, flujos, datos, excepciones
  │  Clasifica cada hallazgo: Claro / Ambiguo / Faltante
  ▼
Paso 2: Resolucion de Gaps
  │  Presenta solo items Ambiguos y Faltantes
  │  Hace 3-5 preguntas por turno, priorizando las bloqueantes
  │  Itera hasta resolver los items criticos
  ▼
Paso 3: Descomposicion en Epicas y Features
  │  Genera la estructura jerarquica Epica → Feature
  │  Presenta al usuario ANTES de generar HUs
  ▼
Paso 4: Generacion de Historias de Usuario
  │  Genera HUs con: narrativa, Gherkin, reglas, dependencias
  │  Sigue los templates estandar del agente
  ▼
Paso 5: Validacion INVEST
  │  Evalua cada HU: Independiente, Negociable, Valiosa, Estimable, Pequena, Testeable
  │  Corrige automaticamente las que fallan; escala al usuario si no puede resolver
  ▼
Paso 6: Presentacion y Review
  │  Entrega el documento completo
  │  Ofrece ajustes: modificar, dividir, fusionar, eliminar HUs
  ▼
Paso 6b: Priorizacion MoSCoW (opcional, solo si el usuario lo pide)
     Clasifica HUs en: Must / Should / Could / Won't
```

### Salida generada

**Archivo:** `docs/analisis/analisis-[nombre-documento].md`

**Estructura del archivo:**

```
## Resumen Ejecutivo
- Total: X Epicas, Y Features, Z Historias de Usuario
- Dominio: [tipo de proyecto]
- Actores: [lista]

## Mapa de Descomposicion
EPICA-01: [nombre]
  ├── FEAT-01: [nombre]
  │   ├── HU-001: [titulo]
  │   └── HU-002: [titulo]
  └── FEAT-02: [nombre]
      └── HU-003: [titulo]

## Detalle de Historias de Usuario
[Cada HU con narrativa, Gherkin, reglas, dependencias, validacion INVEST]

## Supuestos y Pendientes
[Items no confirmados, con impacto y HUs afectadas]

## Dependencias entre HUs
[Mapa de dependencias]
```

---

## Comando: `/refinar-hu`

### Firma

```
/refinar-hu <archivo> [foco]
```

### Parametros

| Parametro | Requerido | Descripcion |
|-----------|-----------|-------------|
| `archivo` | Si | Ruta al archivo que contiene las HUs a refinar. Formatos: `.txt`, `.md`, `.pdf` |
| `foco` | No | Texto libre indicando en que enfocarse (ej: "mejorar Gherkin", "validar INVEST", "faltan escenarios de error") |

### Ejemplos de invocacion

```
# Refinamiento general
/refinar-hu backlog/sprint-3-hus.md

# Con foco especifico
/refinar-hu historias-modulo-pagos.md "faltan escenarios de error"

# Validacion INVEST
/refinar-hu docs/hu-draft.md "verificar que cumplan INVEST"
```

### Tipos de problemas que detecta

| Tipo | Accion del agente |
|------|-------------------|
| Narrativa debil | Reescribe con rol, accion y beneficio claros |
| Gherkin ausente o vago | Genera o mejora criterios de aceptacion |
| HU demasiado grande | Propone division con estrategia explicada |
| Falla INVEST | Propone correccion especifica por criterio |
| Reglas de negocio implicitas | Las extrae y hace explicitas |
| Dependencias ocultas | Las identifica y documenta |
| Duplicacion/solapamiento | Senala HUs que se solapan y propone consolidacion |

### Workflow de ejecucion

```
Paso R1: Lectura y Diagnostico
  │  Lee las HUs proporcionadas
  │  Evalua contra INVEST, calidad Gherkin, completitud
  ▼
Paso R2: Clasificacion de Problemas
  │  Agrupa hallazgos por tipo y severidad
  ▼
Paso R3: Presentacion de Diagnostico
  │  Resumen: cuantas HUs revisadas, cuantas con problemas, distribucion
  │  Tabla de hallazgos por HU (ID, problema, severidad, accion)
  │  Pregunta: corregir todas, solo criticas, o HUs especificas
  ▼
Paso R4: Correccion
  │  Para cada HU: muestra original vs corregida con justificacion
  │  Si necesita dividir: propone nuevas HUs y pide confirmacion
  │  Si hay solapamiento: propone consolidacion y pide confirmacion
  ▼
Paso R5: Entregable de Refinamiento
     Genera archivo con tabla comparativa y registro de cambios
```

### Salida generada

**Archivo:** `docs/analisis/refinamiento-[nombre-documento].md`

**Estructura del archivo:**

```
## Resumen de Hallazgos
- HUs revisadas: X
- HUs con problemas: Y
- Distribucion por tipo de problema

## Registro de Cambios
| HU | Tipo de cambio | Antes (resumen) | Despues (resumen) | Justificacion |

## HUs Refinadas
[Cada HU refinada con detalle completo]

## Recomendaciones Adicionales
[Si las hay]
```

---

## Formato de los Artefactos

### Jerarquia

```
Epica (objetivo de negocio grande)
  └── Feature (capacidad funcional)
        └── Historia de Usuario (incremento de valor entregable)
              └── Criterio de Aceptacion (escenario Gherkin verificable)
```

### Nomenclatura

| Artefacto | Patron | Ejemplo |
|-----------|--------|---------|
| Epica | EPICA-[##] | EPICA-01 |
| Feature | FEAT-[##] | FEAT-03 |
| Historia de Usuario | HU-[###] | HU-015 |
| Criterio de Aceptacion | CA-[HU]-[#] | CA-015-3 |

La numeracion es secuencial dentro de cada documento. Si el proyecto ya tiene
su propia convencion de IDs, el agente la adopta.

### Estructura de una Historia de Usuario

```
## HU-[ID]: [Titulo breve y descriptivo]

**Feature padre:** FEAT-[ID]

### Narrativa
Como [rol/actor]
quiero [accion o capacidad]
para [beneficio o valor que obtengo]

### Criterios de Aceptacion

**CA-[HU]-1: [Nombre del escenario]**
  Dado que [contexto/precondicion]
  Cuando [accion del usuario]
  Entonces [resultado esperado observable]

### Reglas de Negocio
- RN-1: [Regla funcional]

### Dependencias
- [HU-XXX o "Ninguna"]

### Notas y Supuestos
- [Si los hay]

### Validacion INVEST
- Independiente: [check]
- Negociable: [check]
- Valiosa: [check]
- Estimable: [check]
- Pequena: [check]
- Testeable: [check]
```

### Criterios Gherkin

Los criterios de aceptacion siguen formato Gherkin funcional:

- **Dado** (Given) = contexto o precondicion, NO una accion
- **Cuando** (When) = UNA accion del usuario
- **Entonces** (Then) = resultado observable y verificable por un humano

Todos los criterios usan lenguaje de negocio, nunca jerga tecnica.

---

## Manejo de Informacion Incompleta

El agente clasifica la informacion faltante en tres niveles:

| Nivel | Etiqueta | Comportamiento |
|-------|----------|----------------|
| Bloqueante | `[PENDIENTE-BLOQUEANTE]` | No genera HUs que dependan de esa informacion |
| Importante | `[SUPUESTO]` | Continua con la mejor inferencia, documenta el supuesto |
| Deseable | *(omitido)* | Anota en la seccion de Supuestos del entregable final |

Los supuestos se documentan en una tabla con: ID, descripcion, origen en el documento,
impacto si es incorrecto, y HUs afectadas.

---

## Priorizacion MoSCoW (opcional)

Solo se ejecuta si el usuario lo solicita explicitamente. Clasifica las HUs en:

| Prioridad | Significado |
|-----------|-------------|
| **Must** | Sin esto el sistema no cumple su objetivo principal |
| **Should** | Alto valor pero el sistema funciona sin ello en primera version |
| **Could** | Mejora la experiencia pero no es critico |
| **Won't** | Descartado para este alcance, documentado para futuras iteraciones |

---

## Interaccion con el Usuario

El agente es interactivo por diseno. Nunca genera artefactos sin confirmacion previa.

- Hace maximo **3-5 preguntas por turno**, priorizando las mas criticas
- Agrupa preguntas por tema
- Presenta resumen antes del detalle
- Cierra cada entrega con: "Necesitas ajustar algo?"
- Responde en **espanol**

---

## Restricciones del Agente

El agente NO realiza:

- Diseno tecnico, arquitectura, modelado de datos ni diagramas UML
- Estimacion en horas, puntos de historia ni story points
- Creacion de tareas tecnicas (spikes, deuda tecnica, CI/CD)
- Sugerencias de tecnologias, frameworks, herramientas o plataformas
- Pruebas de software, scripts de test ni automatizacion QA
- Gestion de proyecto (cronogramas, sprints, velocidad del equipo)

---

## Configuracion Tecnica del Agente

| Propiedad | Valor |
|-----------|-------|
| Modelo | Sonnet |
| Herramientas | Read, Glob, Grep, Write, AskUserQuestion |
| Max turnos | 30 |
| Permisos | bypassPermissions (no pide confirmacion para leer/escribir) |
| Idioma | Espanol |
