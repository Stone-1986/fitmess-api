---
name: actualizar-docs
description: Revisa cambios recientes en el proyecto y propone actualizaciones puntuales a CLAUDE.md, rules, skills y memory. Clasifica cada hallazgo por destino y presenta los cambios para aprobacion del humano. Usar despues de hitos, refactors o cambios estructurales.
---

# Skill: /actualizar-docs — Actualizacion Inteligente de Documentacion

## Uso

```
/actualizar-docs                           # Revision completa desde el ultimo tag/commit relevante
/actualizar-docs "feature folders en auth" # Contexto especifico de que cambio
```

---

## Flujo paso a paso

### 1. Recopilar contexto de cambios

Ejecutar en paralelo:

```bash
# Commits recientes (ultimos 20 o desde el ultimo tag de epica)
git log --oneline -20

# Archivos modificados (staged + unstaged + untracked)
git status

# Diff de archivos de documentacion del proyecto
git diff HEAD -- CLAUDE.md .claude/rules/ .claude/skills/ .claude/docs/
```

Si hay argumentos (`$ARGUMENTS`), usarlos como contexto adicional de lo que cambio.

### 2. Leer estado actual de la documentacion

Leer en paralelo:

| Archivo | Proposito |
|---------|-----------|
| `CLAUDE.md` | Indice principal — commands, architecture, module structure, skills |
| `.claude/rules/rulesCodigo.md` | Reglas absolutas de codigo |
| `.claude/rules/rulesArquitectura.md` | Reglas absolutas de arquitectura |
| `.claude/docs/guia-de-uso.md` | Manual de usuario |
| `~/.claude/projects/-home-jonfonse-projects-fitmess-fitmess-api/memory/MEMORY.md` | Memoria persistente entre sesiones |

Opcionalmente leer skills relevantes si los cambios afectan un dominio especifico.

### 3. Analizar y clasificar hallazgos

Para cada cambio detectado, clasificar en una de estas categorias:

| Destino | Criterio | Ejemplo |
|---------|----------|---------|
| **CLAUDE.md** | Afecta a TODOS los agentes/sesiones desde el primer momento | Nuevo modulo, nuevo comando, cambio de arquitectura |
| **Rule** | Regla absoluta nueva o modificada | Nueva convencion obligatoria, prohibicion |
| **Skill** | Patron de implementacion nuevo o modificado | Nuevo patron de testing, convencion de DTOs |
| **Memory** | Decision puntual o contexto entre sesiones | Resultado de un post-mortem, preferencia del usuario |
| **Guia de uso** | Nuevo comando, cambio de flujo, nuevo troubleshooting | Nuevo slash command, nuevo gate |
| **Ninguno** | Ya esta documentado o es trivial | Rename de variable, fix menor |

### 4. Presentar propuestas al humano

Mostrar las propuestas agrupadas por destino usando este formato:

```
## Propuestas de actualizacion

### CLAUDE.md (N cambios)
1. [Seccion] Descripcion del cambio propuesto
2. [Seccion] Descripcion del cambio propuesto

### Rules (N cambios)
1. [Archivo § Seccion] Descripcion del cambio propuesto

### Skills (N cambios)
1. [Skill § Seccion] Descripcion del cambio propuesto

### Guia de uso (N cambios)
1. [Seccion] Descripcion del cambio propuesto

### Memory (N cambios)
1. Descripcion de lo que se registraria

### Sin cambios necesarios
- [Razon por la que X no necesita actualizacion]
```

### 5. Pedir confirmacion

Usar `AskUserQuestion` con opciones:
- **Aplicar todos** — aplica todas las propuestas
- **Seleccionar** — el humano indica cuales aplicar (por numero)
- **Cancelar** — no aplica nada

### 6. Aplicar cambios aprobados

Editar los archivos correspondientes con los cambios aprobados. Usar `Edit` para modificaciones puntuales, nunca `Write` (para no sobreescribir contenido existente).

### 7. Verificacion

Mostrar resumen final:
- Archivos modificados
- Secciones actualizadas
- Cerrar con: "Documentacion actualizada. ¿Necesitas ajustar algo?"

---

## Reglas

- NUNCA sobreescribir CLAUDE.md completo — solo ediciones puntuales
- NUNCA agregar contenido duplicado — verificar que no existe antes de agregar
- NUNCA agregar contenido especulativo — solo documentar lo que esta confirmado en el codigo
- Mantener el tono y formato existente de cada archivo
- Los mensajes y descripciones van en **espanol**
- Si no hay cambios que documentar, informar y salir sin modificar nada
- Si hay duda sobre donde va un hallazgo, clasificar como **Memory** (menos intrusivo)

---

## Destinos detallados

### CLAUDE.md — Que actualizar

| Seccion | Cuando actualizar |
|---------|-------------------|
| `Common Commands` | Nuevo script en package.json que se use frecuentemente |
| `Architecture` | Nueva dependencia principal, cambio de stack |
| `Available Skills` | Skill nuevo o eliminado |
| `Module Structure` | Nuevo modulo, modulo renombrado, anotacion multi-feature |
| `Project Rules` | Nuevo archivo de rules (raro) |
| `Code Style` | Cambio en ESLint/Prettier config |

### Rules — Que actualizar

- Nueva prohibicion o convencion obligatoria descubierta en un post-mortem
- Gate duro nuevo (compilacion, cobertura, linting)
- Correccion de una regla existente que resulto incorrecta o incompleta

### Skills — Que actualizar

- Patron de implementacion nuevo confirmado en codigo
- Cambio en estructura de archivos que afecta convenciones
- Nuevo ejemplo o referencia descubierta durante implementacion

### Guia de uso — Que actualizar

- Nuevo slash command disponible
- Cambio en el flujo de trabajo
- Nuevo troubleshooting descubierto
- Nuevo gate o nivel de verificacion
- Cambio en archivos clave del flujo

### Memory — Que actualizar

- Decision de arquitectura puntual
- Preferencia del usuario confirmada
- Resultado de investigacion o post-mortem
- Contexto que se necesita entre sesiones pero no es una regla
