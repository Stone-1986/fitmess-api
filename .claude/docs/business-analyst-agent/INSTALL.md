# Business Analyst Agent para Claude Code

Agente que transforma documentos de requerimientos en artefactos agiles estructurados:
Epicas, Features e Historias de Usuario con criterios de aceptacion Gherkin.

## Contenido del paquete

```
business-analyst-agent/
├── agents/
│   └── business-analyst.md              # Definicion del agente (persona + config)
├── skills/
│   ├── analizar-requerimiento/
│   │   └── SKILL.md                     # /analizar-requerimiento <archivo> [contexto]
│   ├── refinar-hu/
│   │   └── SKILL.md                     # /refinar-hu <archivo> [foco]
│   └── requirements-decomposition/
│       ├── SKILL.md                     # Workflow de descomposicion (6 pasos)
│       └── references/
│           ├── templates.md             # Templates Epica/Feature/HU + ejemplos
│           ├── refinement-checklist.md  # Checklist de refinamiento (8 categorias)
│           └── quality-criteria.md      # Criterios INVEST + calidad Gherkin
└── INSTALL.md                           # Esta guia
```

## Requisitos

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) instalado y funcional

## Instalacion

### Opcion A: Personal (disponible en todos tus proyectos)

```bash
# macOS / Linux
mkdir -p ~/.claude/agents ~/.claude/skills
cp agents/business-analyst.md ~/.claude/agents/
cp -r skills/requirements-decomposition ~/.claude/skills/
cp -r skills/analizar-requerimiento ~/.claude/skills/
cp -r skills/refinar-hu ~/.claude/skills/
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\agents", "$env:USERPROFILE\.claude\skills"
Copy-Item "agents\business-analyst.md" "$env:USERPROFILE\.claude\agents\" -Force
Copy-Item "skills\requirements-decomposition" "$env:USERPROFILE\.claude\skills\" -Recurse -Force
Copy-Item "skills\analizar-requerimiento" "$env:USERPROFILE\.claude\skills\" -Recurse -Force
Copy-Item "skills\refinar-hu" "$env:USERPROFILE\.claude\skills\" -Recurse -Force
```

### Opcion B: Proyecto compartido (via git, todo el equipo lo usa)

```bash
# Desde la raiz del repositorio destino
mkdir -p .claude/agents .claude/skills
cp agents/business-analyst.md .claude/agents/
cp -r skills/requirements-decomposition .claude/skills/
cp -r skills/analizar-requerimiento .claude/skills/
cp -r skills/refinar-hu .claude/skills/

git add .claude/agents .claude/skills
git commit -m "feat: add business-analyst agent for requirements decomposition"
```

### Opcion C: Proyecto local (solo tu, sin compartir)

```bash
# Desde la raiz del repositorio destino
mkdir -p .claude/agents .claude/skills
cp agents/business-analyst.md .claude/agents/
cp -r skills/requirements-decomposition .claude/skills/
cp -r skills/analizar-requerimiento .claude/skills/
cp -r skills/refinar-hu .claude/skills/

# Agregar a .gitignore
cat >> .gitignore << 'EOF'
.claude/agents/business-analyst.md
.claude/skills/requirements-decomposition/
.claude/skills/analizar-requerimiento/
.claude/skills/refinar-hu/
EOF
```

### Estructura resultante

```
~/.claude/                    # Opcion A
# o
<tu-proyecto>/.claude/        # Opciones B y C

├── agents/
│   └── business-analyst.md
└── skills/
    ├── analizar-requerimiento/
    │   └── SKILL.md
    ├── refinar-hu/
    │   └── SKILL.md
    └── requirements-decomposition/
        ├── SKILL.md
        └── references/
            ├── templates.md
            ├── refinement-checklist.md
            └── quality-criteria.md
```

## Verificacion

1. Reiniciar Claude Code (cerrar y abrir de nuevo)
2. Escribir `/` y buscar en la lista: deben aparecer `analizar-requerimiento` y `refinar-hu`
3. Prueba rapida:

```
/analizar-requerimiento mi-archivo-de-prueba.txt
```

El agente debe responder con la fase de Descubrimiento de Contexto.

## Uso

### Analisis completo de un documento de requerimientos

```
/analizar-requerimiento requirements.txt
```

### Analisis con contexto previo (salta descubrimiento)

```
/analizar-requerimiento specs.txt "App de delivery, actores: cliente, repartidor, restaurante, admin"
```

### Refinamiento de HUs existentes

```
/refinar-hu backlog/historias-sprint-4.md
```

### Refinamiento con foco especifico

```
/refinar-hu mis-hus.md "mejorar criterios Gherkin y validar INVEST"
```

## Formatos de entrada soportados

- `.txt` — Texto plano
- `.md` — Markdown
- `.pdf` — PDF (maximo ~20 paginas por lectura)

## Comportamiento

- **Modelo:** Sonnet (balance entre razonamiento y costo)
- **Herramientas:** Read, Glob, Grep, Write, AskUserQuestion
- **Idioma:** Responde en espanol
- **Interactivo:** Siempre pregunta antes de asumir
- **Agnostico:** Se adapta al vocabulario y dominio de cada documento
- **Salida:** Genera archivos en `docs/analisis/` del proyecto

## Desinstalacion

```bash
# Personal
rm ~/.claude/agents/business-analyst.md
rm -rf ~/.claude/skills/requirements-decomposition
rm -rf ~/.claude/skills/analizar-requerimiento
rm -rf ~/.claude/skills/refinar-hu

# Proyecto
rm .claude/agents/business-analyst.md
rm -rf .claude/skills/requirements-decomposition
rm -rf .claude/skills/analizar-requerimiento
rm -rf .claude/skills/refinar-hu
```
