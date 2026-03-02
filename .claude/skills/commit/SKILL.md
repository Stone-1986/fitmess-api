---
name: commit
description: Crea commits estandarizados con Conventional Commits, auto-staging por checkpoint y tags para trazabilidad de épicas. Usar para cualquier commit del proyecto — tanto del flujo de épicas como commits generales.
---

# Skill: /commit — Commits Estandarizados

## Uso

```
/commit                    # Interactivo — pregunta tipo, scope, descripción
/commit checkpoint 1       # Directo — commit de Checkpoint 1
/commit fix auth           # Directo — fix(auth) con descripción por definir
```

---

## Tipos de Commit

### Flujo de épicas (4 tipos)

| Tipo | Prefijo | Mensaje | Staging automático | Tag |
|------|---------|---------|-------------------|-----|
| Checkpoint 1 | `feat` | `feat(EPICA-XX): checkpoint 1 — plan y contrato aprobados` | `outputs/ prisma/schema.prisma` | `EPICA-XX/checkpoint-1` |
| Post-migración | `chore` | `chore(EPICA-XX): migración aplicada` | `prisma/migrations/` | — |
| Re-planificación | `refactor` | `refactor(EPICA-XX): re-planificación tras feedback` | `outputs/ prisma/schema.prisma` | — |
| Checkpoint 2 | `feat` | `feat(EPICA-XX): implementación completa — ciclo N` | `src/ test/ outputs/` | `EPICA-XX/checkpoint-2` |

Para los tipos de épica, el ID (`EPICA-XX`) se obtiene automáticamente de `outputs/epica_input.yaml`.

### Commits generales (6 tipos — Conventional Commits)

| Prefijo | Uso |
|---------|-----|
| `feat(scope)` | Nueva funcionalidad |
| `fix(scope)` | Corrección de bug |
| `refactor(scope)` | Refactoring sin cambio funcional |
| `docs(scope)` | Documentación |
| `chore(scope)` | Mantenimiento, dependencias, config |
| `test(scope)` | Tests |

---

## Flujo paso a paso

```
1. Ejecutar `git status` y mostrar el estado actual al humano
   - Si no hay cambios (ni staged ni unstaged ni untracked), informar y salir

2. Preguntar tipo de commit (AskUserQuestion):
   Opciones épica: Checkpoint 1 / Post-migración / Re-planificación / Checkpoint 2
   Opciones generales: feat / fix / refactor / docs / chore / test

3. Obtener scope y descripción:
   - Si es tipo épica → leer `outputs/epica_input.yaml` para obtener el ID (EPICA-XX)
   - Si es tipo general → preguntar scope (ej: auth, common, prisma) y descripción corta

4. Determinar archivos a stagear según tipo:
   - Checkpoint 1:     outputs/ prisma/schema.prisma
   - Post-migración:   prisma/migrations/
   - Re-planificación: outputs/ prisma/schema.prisma
   - Checkpoint 2:     src/ test/ outputs/
   - General:          preguntar al humano o usar archivos modificados visibles en git status

5. Filtrar archivos prohibidos (NUNCA stagear):
   - .env (con valores reales)
   - node_modules/
   - dist/
   - coverage/
   - *.log

6. Mostrar resumen al humano:
   - Archivos que se van a stagear (listar)
   - Mensaje de commit completo
   - Tag (si aplica)
   - Pedir confirmación (AskUserQuestion: Confirmar / Cancelar)

7. Si confirma:
   - git add <archivos>
   - git commit -m "<mensaje>"
   - git tag -a <tag> -m "<mensaje>" (solo si aplica: Checkpoint 1 o 2)
   - Mostrar resultado final
```

---

## Formato de mensajes

Todos los mensajes siguen Conventional Commits:

```
<tipo>(<scope>): <descripción>
```

Reglas:
- `tipo` en minúsculas: feat, fix, refactor, docs, chore, test
- `scope` en minúsculas: EPICA-XX para épicas, nombre de módulo para generales
- `descripción` en español, minúsculas, sin punto final
- Máximo 72 caracteres en la primera línea

Ejemplos:
```
feat(EPICA-01): checkpoint 1 — plan y contrato aprobados
chore(EPICA-01): migración aplicada
refactor(EPICA-01): re-planificación tras feedback
feat(EPICA-01): implementación completa — ciclo 2
feat(auth): agregar endpoint de registro de entrenador
fix(common): corregir serialización de BusinessException
docs(api-first): actualizar decoradores Swagger
chore(deps): actualizar @nestjs/core a v11.1
test(auth): agregar tests e2e para login
refactor(plans): extraer lógica de validación a método privado
```

---

## Tags de épica

Solo se crean tags en Checkpoint 1 y Checkpoint 2:

```
EPICA-XX/checkpoint-1    # Annotated tag tras aprobación del plan
EPICA-XX/checkpoint-2    # Annotated tag tras implementación completa
```

Formato del tag:
```bash
git tag -a EPICA-XX/checkpoint-N -m "feat(EPICA-XX): <descripción>"
```

---

## Protecciones

- NUNCA stagear archivos `.env` con valores reales
- NUNCA stagear `node_modules/`, `dist/`, `coverage/`, `*.log`
- SIEMPRE mostrar `git status` y el resumen completo ANTES de pedir confirmación
- Si no hay cambios para commitear, informar y salir sin hacer nada
- Si `outputs/epica_input.yaml` no existe y se eligió un tipo de épica, informar y pedir el ID manualmente
