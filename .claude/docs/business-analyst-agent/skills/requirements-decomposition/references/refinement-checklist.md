# Checklist de Refinamiento

Preguntas organizadas por categoría para identificar gaps en requerimientos.
No hacer todas las preguntas — seleccionar solo las relevantes al documento
analizado. Priorizar las que bloquean la generación de HUs.

---

## 1. Reglas de Negocio

Preguntas para descubrir reglas no explícitas:

- ¿Qué pasa cuando [entidad] tiene estado [X]? ¿Puede realizar [acción]?
- ¿Existen límites o umbrales? (cantidades máximas, montos tope, intentos permitidos)
- ¿Las reglas cambian según el rol del usuario? ¿Cómo?
- ¿Hay excepciones a las reglas mencionadas? ¿Quién puede autorizar excepciones?
- ¿Las reglas son las mismas para todos los canales? (web, móvil, presencial)
- ¿Hay reglas temporales? (horarios, fechas, períodos)
- ¿Qué sucede con [entidad] cuando se elimina/desactiva [entidad relacionada]?

**Señales de alerta en el documento:**
- "generalmente", "normalmente", "en la mayoría de los casos" → hay excepciones no documentadas
- "según corresponda", "cuando aplique" → regla ambigua, preguntar cuándo aplica exactamente
- Ausencia de flujos alternativos → solo se describe el happy path

---

## 2. Actores y Roles

- ¿[Rol X] y [Rol Y] son el mismo actor con diferente nombre o son roles distintos?
- ¿Quién más interactúa con este proceso además de los mencionados?
- ¿Existe un rol de administrador o supervisor no mencionado?
- ¿Los roles tienen niveles o jerarquías? (ej: aprobador nivel 1, nivel 2)
- ¿Un usuario puede tener múltiples roles simultáneamente?
- ¿Hay actores externos al sistema? (otros sistemas, procesos batch, entidades regulatorias)

**Señales de alerta:**
- "el usuario" sin especificar qué tipo de usuario
- Acciones pasivas sin actor ("se envía un correo", "se actualiza el estado") → ¿quién o qué lo hace?

---

## 3. Dependencias e Integraciones

- ¿Este flujo depende de que otro proceso se haya completado antes?
- ¿Qué pasa si [sistema/proceso externo] no está disponible?
- ¿La información viene de algún sistema existente o se ingresa manualmente?
- ¿Otros procesos se ven afectados cuando se completa esta acción?
- ¿Hay procesos que corren en paralelo y podrían generar conflictos?
- ¿Existen datos compartidos entre módulos que podrían quedar inconsistentes?

**Señales de alerta:**
- "se consulta", "se obtiene de" → integración implícita no detallada
- "en tiempo real" → ¿realmente tiempo real o puede haber un delay aceptable?

---

## 4. Datos e Información

- ¿Cuáles son los datos obligatorios vs opcionales para [entidad/proceso]?
- ¿Hay datos que tienen formato específico? (ej: identificación fiscal, teléfono)
- ¿Los datos tienen validaciones de negocio? (ej: fecha de nacimiento no puede ser futura)
- ¿Quién puede ver qué datos? ¿Hay datos confidenciales o restringidos?
- ¿Los datos se pueden modificar después de creados? ¿Todos o solo algunos?
- ¿Hay datos que se calculan automáticamente? ¿Con qué lógica?

**Señales de alerta:**
- Listas de campos sin indicar cuáles son obligatorios
- Campos con nombres ambiguos ("tipo", "estado", "categoría") → ¿cuáles son los valores posibles?

---

## 5. Flujos y Procesos

- ¿Qué pasa si el usuario abandona el proceso a mitad de camino?
- ¿Se puede deshacer/revertir esta acción? ¿Quién puede y bajo qué condiciones?
- ¿Hay un tiempo límite para completar el proceso?
- ¿Qué sucede si dos usuarios intentan hacer lo mismo al mismo tiempo?
- ¿El proceso es lineal o puede tener saltos/bifurcaciones?
- ¿Existe un flujo de aprobación? ¿Cuántos niveles? ¿Quién aprueba en cada nivel?

**Señales de alerta:**
- Solo se describe el flujo exitoso (falta flujo de error, cancelación, timeout)
- "el sistema procesa" sin detallar qué significa "procesar"

---

## 6. Notificaciones y Comunicación

- ¿Quién debe ser notificado cuando ocurre [evento]?
- ¿Por qué canal? (email, push, SMS, en la aplicación)
- ¿Las notificaciones son configurables por el usuario?
- ¿Hay notificaciones de escalamiento? (ej: si no se atiende en X tiempo)
- ¿Qué información debe contener la notificación?

**Señales de alerta:**
- "se notifica" sin especificar a quién, cómo ni cuándo

---

## 7. Aspectos Regulatorios y Compliance

Solo preguntar si el documento menciona regulación o si el dominio lo sugiere:

- ¿Hay normativas que restrinjan cómo se manejan ciertos datos?
- ¿Se requiere consentimiento explícito del usuario para algún proceso?
- ¿Hay requisitos de auditoría o trazabilidad?
- ¿Existen plazos legales que impacten el proceso?
- ¿Hay restricciones geográficas o jurisdiccionales?

---

## 8. Experiencia de Usuario (funcional)

Sin entrar en diseño visual, validar la experiencia funcional:

- ¿El usuario necesita confirmación antes de acciones irreversibles?
- ¿Hay acciones en lote? (ej: aprobar múltiples solicitudes a la vez)
- ¿El usuario necesita ver un historial de sus acciones?
- ¿Hay búsqueda o filtrado de información? ¿Por qué criterios?
- ¿Se necesitan reportes o resúmenes? ¿Para qué roles?

---

## Priorización de Preguntas

Cuando hay muchos gaps, priorizar así:

1. **Bloqueante** — Sin esta respuesta, no se puede generar ninguna HU del flujo
2. **Importante** — Afecta los criterios de aceptación de varias HUs
3. **Deseable** — Mejora la precisión pero se puede documentar como supuesto

Hacer las bloqueantes primero. Las deseables pueden quedarse como supuestos
documentados si el usuario no tiene la respuesta inmediatamente.
