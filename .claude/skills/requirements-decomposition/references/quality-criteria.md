# Criterios de Calidad para Historias de Usuario

## Criterios INVEST

Cada Historia de Usuario debe evaluarse contra estos 6 criterios.

- ✅ Cumple — La HU satisface el criterio completamente
- ⚠️ Cumple parcialmente — No cumple al 100% pero es aceptable (documentar por qué)
- ❌ No cumple — La HU falla el criterio y requiere corrección antes de incluirse en el entregable

**Cuando una HU recibe ❌ en cualquier criterio:** corregirla (reescribir, dividir o
reformular). Si después de corregir sigue sin cumplir, escalar al usuario para que
decida: reformular el requerimiento, fusionar con otra HU, o aceptar la excepción.

### I — Independiente

La HU puede implementarse sin requerir que otra HU se complete primero.

**Cumple cuando:**
- Se puede desarrollar, probar y entregar por separado
- No necesita que otra HU esté terminada para funcionar

**No cumple cuando:**
- "Esta HU solo funciona si HU-XXX ya está implementada"
- El criterio de aceptación referencia funcionalidad de otra HU

**Cómo corregir:**
- Incluir la precondición dentro de la misma HU (aunque sea simplificada)
- Si la dependencia es inevitable, documentarla explícitamente y asegurar
  que ambas HUs puedan desarrollarse en paralelo hasta el punto de integración

**Cuándo es aceptable ⚠️:**
- Dependencia de autenticación/login (es transversal, no se repite en cada HU)
- Dependencia de datos maestros (catálogos, configuración base)

---

### N — Negociable

La HU describe QUÉ se necesita, no CÓMO se implementa. El equipo técnico
tiene libertad para elegir la solución.

**Cumple cuando:**
- Describe la necesidad del usuario y el resultado esperado
- No prescribe tecnología, diseño visual ni arquitectura
- Los criterios de aceptación definen el qué, no el cómo

**No cumple cuando:**
- "Usar un dropdown con búsqueda autocompletable"
- "Guardar en una tabla con campos X, Y, Z"
- "Enviar por API REST al sistema externo"

**Cómo corregir:**
- Reemplazar prescripciones técnicas por resultados funcionales
- "El usuario puede seleccionar entre las opciones disponibles" ✓
- "La información queda registrada para consulta posterior" ✓

---

### V — Valiosa

La HU entrega valor tangible a un usuario o al negocio.

**Cumple cuando:**
- Se puede responder: "¿Por qué el usuario/negocio necesita esto?"
- El "para [beneficio]" de la narrativa es concreto y medible
- Un stakeholder diría "sí, esto me importa"

**No cumple cuando:**
- Es una tarea técnica disfrazada de HU ("Como sistema quiero una BD...")
- El beneficio es vago: "para mejorar la experiencia"
- Solo beneficia al equipo técnico, no al usuario ni al negocio

**Cómo corregir:**
- Reformular desde la perspectiva del usuario final
- Si es infraestructura, no es HU — es tarea técnica (fuera de nuestro alcance)

---

### E — Estimable

El equipo puede estimar el esfuerzo de implementación.

**Cumple cuando:**
- El alcance es claro: se sabe dónde empieza y dónde termina
- Los criterios de aceptación son suficientemente específicos
- No hay incógnitas grandes sin resolver

**No cumple cuando:**
- "El sistema maneja todos los casos posibles de [X]" — ¿cuántos son?
- Los criterios de aceptación son vagos: "funciona correctamente"
- Hay dependencias externas con alcance desconocido

**Cómo corregir:**
- Acotar el alcance con casos específicos
- Enumerar los escenarios que se cubren (y explícitamente los que no)
- Resolver las incógnitas en la fase de preguntas

---

### S — Pequeña (Small)

La HU es lo suficientemente pequeña para completarse en una iteración.

**Cumple cuando:**
- Cubre UN flujo funcional completo (no medio flujo)
- Se puede implementar y probar en días, no semanas
- Tiene máximo 5-7 criterios de aceptación

**No cumple cuando:**
- Tiene más de 8 criterios de aceptación
- Cubre múltiples flujos o múltiples roles
- Incluye "y también..." repetidamente (señal de épica disfrazada)

**Cómo corregir:**
- Dividir por rol: una HU por cada rol que interactúa
- Dividir por flujo: separar happy path, flujo alternativo y flujo de error
- Dividir por operación: separar crear, editar, eliminar, consultar

**Guía de división:**

| Señal | División sugerida |
|-------|-------------------|
| Múltiples roles en una HU | Una HU por rol |
| CRUD completo en una HU | Separar en crear, consultar, editar, eliminar |
| Happy path + 5 excepciones | HU base + HU de manejo de excepciones |
| Flujo con aprobación | HU de solicitud + HU de aprobación |
| Muchas reglas de negocio | HU base con reglas simples + HU con reglas complejas |

---

### T — Testeable

Se puede verificar objetivamente si la HU está completa.

**Cumple cuando:**
- Los criterios de aceptación tienen resultados concretos y observables
- Un usuario de negocio puede verificar si se cumple o no
- No hay subjetividad: "el usuario ve [dato específico]" ✓

**No cumple cuando:**
- "El sistema es rápido" — ¿qué significa rápido?
- "El usuario tiene una buena experiencia" — ¿cómo se mide?
- "Funciona correctamente" — ¿qué es "correctamente"?

**Cómo corregir:**
- Reemplazar adjetivos subjetivos por resultados observables
- "Es rápido" → "El resultado se muestra en la misma pantalla sin navegación adicional"
- "Buena experiencia" → "El usuario completa el proceso en máximo 3 pasos"

---

## Calidad del Gherkin

### Criterios para buenos escenarios Gherkin

1. **Un comportamiento por escenario.** Cada Dado/Cuando/Entonces prueba UNA cosa.
   No combinar múltiples validaciones en un solo escenario.

2. **Given = contexto, no acción.** El Dado establece estado, no describe pasos.
   - ✗ "Dado que el usuario hace login y navega al módulo de reportes"
   - ✓ "Dado que el usuario autenticado está en el módulo de reportes"

3. **When = UNA acción del usuario.** El Cuando es un solo evento.
   - ✗ "Cuando completa el formulario y hace clic en guardar y confirma"
   - ✓ "Cuando confirma el registro"

4. **Then = resultado observable.** El Entonces es verificable por un humano.
   - ✗ "Entonces el registro se guarda en la base de datos"
   - ✓ "Entonces ve un mensaje de confirmación con el número de registro"

5. **Lenguaje de negocio.** Sin jerga técnica en los escenarios.
   - ✗ "Entonces la API retorna 200 OK"
   - ✓ "Entonces la operación se completa exitosamente"

6. **Escenarios necesarios y suficientes.** Cubrir:
   - Happy path (flujo exitoso principal)
   - Validaciones (datos inválidos, campos faltantes)
   - Reglas de negocio (condiciones, límites, permisos)
   - Casos borde relevantes (no todos los imaginables, solo los de negocio)

### Antipatrones a Evitar

| Antipatrón | Problema | Corrección |
|------------|----------|------------|
| Escenario con 5+ And | Probando demasiado | Dividir en escenarios separados |
| Given con acciones | Confunde contexto con pasos | Reescribir como estado |
| Then sin resultado visible | No verificable por usuario | Agregar qué ve/recibe el usuario |
| Escenarios duplicados | Redundancia | Usar Scenario Outline con tabla |
| Jerga técnica | No entendible por negocio | Reescribir en lenguaje de dominio |
| Escenario sin nombre descriptivo | Difícil de entender | Nombrar con el comportamiento que prueba |

### Cuándo usar Scenario Outline vs Escenarios Individuales

| Situación | Usar |
|-----------|------|
| 3+ escenarios con misma estructura, solo varían datos | **Scenario Outline** con tabla de ejemplos |
| Las variaciones son valores de un mismo campo (estados, roles, montos) | **Scenario Outline** |
| La lógica o el flujo cambia entre variaciones | **Escenarios individuales** |
| Cada variación tiene diferentes pasos Given/When | **Escenarios individuales** |
| Solo 2 variaciones (ej: éxito y error) | **Escenarios individuales** (más legibles) |
