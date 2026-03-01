# Templates de Artefactos Ágiles

Templates estándar para la generación de Épicas, Features e Historias de Usuario.
Usar estos formatos como base. Adaptar el vocabulario al dominio del proyecto.

---

## Template: Épica

```
## ÉPICA-[ID]: [Nombre descriptivo orientado al valor de negocio]

**Objetivo de negocio:** [Qué problema resuelve o qué valor genera]

**Actores involucrados:** [Lista de roles que participan]

**Alcance funcional:**
- [Capacidad funcional 1]
- [Capacidad funcional 2]
- [Capacidad funcional N]

**Criterio de éxito:** [Cómo se mide que la épica cumplió su objetivo]

**Features incluidas:**
- FEAT-[ID]: [Nombre]
- FEAT-[ID]: [Nombre]
```

---

## Template: Feature

```
## FEAT-[ID]: [Nombre descriptivo]

**Épica padre:** ÉPICA-[ID]

**Descripción:** [Qué permite hacer esta feature al usuario, en 1-2 oraciones]

**Actores:** [Roles que usan esta feature]

**Historias de Usuario:**
- HU-[ID]: [Título]
- HU-[ID]: [Título]
```

---

## Template: Historia de Usuario

```
## HU-[ID]: [Título breve y descriptivo]

**Feature padre:** FEAT-[ID]

### Narrativa
Como [rol/actor]
quiero [acción o capacidad]
para [beneficio o valor que obtengo]

### Criterios de Aceptación

**CA-[HU]-1: [Nombre del escenario]**
  Dado que [contexto/precondición]
  Cuando [acción del usuario]
  Entonces [resultado esperado observable]

**CA-[HU]-2: [Nombre del escenario]**
  Dado que [contexto/precondición]
  Cuando [acción del usuario]
  Entonces [resultado esperado observable]

### Reglas de Negocio
- RN-1: [Regla funcional que aplica a esta HU]
- RN-2: [Regla funcional que aplica a esta HU]

### Dependencias
- [HU-XXX si existe dependencia, o "Ninguna"]

### Notas y Supuestos
- [Supuesto o nota relevante, si los hay]

### Validación INVEST
- Independiente: ✅/⚠️
- Negociable: ✅/⚠️
- Valiosa: ✅/⚠️
- Estimable: ✅/⚠️
- Pequeña: ✅/⚠️
- Testeable: ✅/⚠️
```

---

## Template: Supuestos y Pendientes

Usar este formato para documentar ítems no confirmados en el entregable final.

```
## Supuestos y Pendientes

### Supuestos Aceptados
Ítems inferidos del documento que no fueron confirmados explícitamente.
El análisis avanzó asumiendo que son correctos.

| ID | Supuesto | Origen | Impacto si es incorrecto | HUs afectadas |
|----|----------|--------|--------------------------|---------------|
| SUP-01 | [Descripción del supuesto] | [Sección/página del documento] | [Qué habría que cambiar] | HU-XXX, HU-YYY |

### Pendientes Bloqueantes
Información faltante que impide generar o completar ciertas HUs.

| ID | Pendiente | Pregunta al stakeholder | HUs bloqueadas |
|----|-----------|-------------------------|----------------|
| PEN-01 | [Qué falta] | [Pregunta concreta para resolver] | HU-XXX |
```

---

## Template: Registro de Cambios (Refinamiento)

Usar este formato en el entregable de refinamiento para tracking de cambios.

```
## Registro de Cambios

| HU | Tipo de cambio | Antes (resumen) | Después (resumen) | Justificación |
|----|---------------|-----------------|-------------------|---------------|
| HU-001 | Narrativa reescrita | "Como usuario quiero..." | "Como vendedor quiero..." | Rol genérico → rol específico |
| HU-003 | Gherkin agregado | Sin criterios | 3 criterios CA-003-1 a CA-003-3 | No era testeable |
| HU-005 | Dividida | 1 HU con 12 criterios | 3 HUs (HU-005a/b/c) | No cumplía Small |
| HU-007, HU-009 | Consolidadas | 2 HUs solapadas | 1 HU (HU-007) | Duplicación de criterios |
```

---

## Gherkin: Patrones Comunes

### Escenario exitoso (happy path)
```gherkin
Dado que el [rol] ha [precondición cumplida]
Cuando [realiza la acción principal]
Entonces [obtiene el resultado esperado]
  Y [efecto secundario si aplica]
```

### Escenario de validación
```gherkin
Dado que el [rol] está en [contexto]
Cuando intenta [acción] con [datos inválidos/incompletos]
Entonces ve un mensaje indicando [qué corregir]
  Y [la operación no se completa]
```

### Escenario con condición de negocio
```gherkin
Dado que el [rol] tiene [condición de negocio: rol, estado, permiso]
Cuando [realiza la acción]
Entonces [resultado específico para esa condición]
```

### Escenario con múltiples resultados (Scenario Outline)

**Cuándo usar Scenario Outline en vez de escenarios individuales:**
- Cuando 3+ escenarios comparten la misma estructura y solo varían datos
- Cuando las variaciones son valores de un mismo campo (estados, roles, categorías)
- NO usar si la lógica cambia entre variaciones (en ese caso, escenarios separados)

```gherkin
Dado que el [rol] tiene el estado <estado>
Cuando solicita [acción]
Entonces el resultado es <resultado_esperado>

Ejemplos:
  | estado   | resultado_esperado          |
  | activo   | se procesa correctamente    |
  | inactivo | ve mensaje de restricción   |
  | pendiente| ve mensaje de espera        |
```

---

## Ejemplos Multi-Dominio

### Ejemplo 1: Dominio Gestión Empresarial

```
## HU-001: Registro de nuevo proveedor

**Feature padre:** FEAT-02

### Narrativa
Como encargado de compras
quiero registrar un nuevo proveedor en el sistema
para poder asociarlo a futuras órdenes de compra

### Criterios de Aceptación

**CA-001-1: Registro exitoso con datos completos**
  Dado que el encargado de compras accede al módulo de proveedores
  Cuando completa todos los campos obligatorios y confirma el registro
  Entonces el proveedor queda registrado con estado "Pendiente de aprobación"
    Y el gerente de compras recibe una notificación de aprobación pendiente

**CA-001-2: Registro con datos incompletos**
  Dado que el encargado de compras está registrando un proveedor
  Cuando intenta confirmar sin completar los campos obligatorios
  Entonces ve los campos faltantes resaltados con mensaje de dato requerido
    Y el registro no se completa

**CA-001-3: Proveedor duplicado**
  Dado que ya existe un proveedor con el mismo número de identificación fiscal
  Cuando el encargado intenta registrar otro con esa identificación
  Entonces ve un aviso indicando que el proveedor ya existe
    Y puede ver los datos del proveedor existente

### Reglas de Negocio
- RN-1: Todo proveedor nuevo inicia en estado "Pendiente de aprobación"
- RN-2: La aprobación requiere firma del gerente de compras
- RN-3: El número de identificación fiscal es único e irrepetible

### Dependencias
- Ninguna

### Validación INVEST
- Independiente: ✅
- Negociable: ✅
- Valiosa: ✅ (habilita el flujo de compras)
- Estimable: ✅
- Pequeña: ✅
- Testeable: ✅
```

### Ejemplo 2: Dominio Atención al Público

```
## HU-012: Agendamiento de cita por el ciudadano

**Feature padre:** FEAT-05

### Narrativa
Como ciudadano
quiero agendar una cita para realizar un trámite
para evitar tiempos de espera presencial

### Criterios de Aceptación

**CA-012-1: Agendamiento exitoso**
  Dado que el ciudadano seleccionó el trámite y la sede
  Cuando elige una fecha y horario disponible y confirma
  Entonces recibe un comprobante con número de cita, fecha, hora y sede
    Y recibe un recordatorio 24 horas antes de la cita

**CA-012-2: Sin disponibilidad en fecha seleccionada**
  Dado que el ciudadano busca disponibilidad para una fecha
  Cuando no hay horarios disponibles en esa fecha
  Entonces ve las próximas 3 fechas con disponibilidad
    Y puede seleccionar una de ellas

**CA-012-3: Límite de citas activas**
  Dado que el ciudadano ya tiene 2 citas activas para el mismo trámite
  Cuando intenta agendar una tercera
  Entonces ve un mensaje indicando que ya tiene el máximo de citas permitidas
    Y puede ver el detalle de sus citas activas

### Reglas de Negocio
- RN-1: Máximo 2 citas activas por ciudadano para el mismo tipo de trámite
- RN-2: Las citas se pueden agendar con mínimo 24 horas de anticipación
- RN-3: El recordatorio se envía por el canal de preferencia del ciudadano

### Dependencias
- HU-010: El ciudadano debe tener cuenta activa en el sistema

### Validación INVEST
- Independiente: ⚠️ (depende de HU-010 para autenticación)
- Negociable: ✅
- Valiosa: ✅ (reduce carga operativa presencial)
- Estimable: ✅
- Pequeña: ✅
- Testeable: ✅
```

### Ejemplo 3: Dominio Proceso Interno (Back-Office)

```
## HU-025: Aprobación de solicitud de vacaciones

**Feature padre:** FEAT-08

### Narrativa
Como jefe de área
quiero aprobar o rechazar solicitudes de vacaciones de mi equipo
para mantener la continuidad operativa del área

### Criterios de Aceptación

**CA-025-1: Aprobación de solicitud**
  Dado que existe una solicitud pendiente de un colaborador de mi equipo
  Cuando reviso los detalles y apruebo la solicitud
  Entonces el colaborador recibe una notificación de aprobación
    Y los días se descuentan de su saldo de vacaciones
    Y las fechas se bloquean en el calendario del área

**CA-025-2: Rechazo con motivo**
  Dado que existe una solicitud pendiente
  Cuando rechazo la solicitud indicando el motivo
  Entonces el colaborador recibe notificación con el motivo del rechazo
    Y los días no se descuentan de su saldo
    Y puede crear una nueva solicitud con fechas diferentes

**CA-025-3: Conflicto de fechas en el equipo**
  Dado que otro colaborador del mismo equipo ya tiene vacaciones aprobadas en ese período
  Cuando reviso la solicitud
  Entonces veo un aviso de solapamiento con el nombre del colaborador y las fechas
    Y puedo decidir aprobar o rechazar considerando esa información

### Reglas de Negocio
- RN-1: Solo el jefe directo puede aprobar vacaciones de su equipo
- RN-2: El sistema muestra alerta si más del 30% del equipo estaría ausente
- RN-3: Solicitudes no atendidas en 5 días hábiles se escalan al nivel superior

### Dependencias
- HU-023: El colaborador debe haber creado la solicitud previamente

### Validación INVEST
- Independiente: ⚠️ (depende de HU-023)
- Negociable: ✅
- Valiosa: ✅ (automatiza proceso manual actual)
- Estimable: ✅
- Pequeña: ✅
- Testeable: ✅
```
