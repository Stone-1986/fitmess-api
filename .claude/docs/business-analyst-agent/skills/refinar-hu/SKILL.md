---
name: refinar-hu
description: Refina Historias de Usuario existentes mejorando narrativas, criterios Gherkin, validación INVEST y detección de gaps. Usar cuando se necesite mejorar, evaluar o corregir HUs ya escritas. Acepta un archivo con HUs o HUs inline.
context: fork
agent: business-analyst
---

# /refinar-hu $ARGUMENTS

Ejecutar el workflow de refinamiento sobre Historias de Usuario existentes.

## Uso

```
/refinar-hu <archivo con HUs>
/refinar-hu <archivo con HUs> "enfocarse en criterios de aceptación"
```

**Ejemplos:**
```
/refinar-hu backlog/sprint-3-hus.md
/refinar-hu historias-modulo-pagos.md "faltan escenarios de error"
/refinar-hu docs/hu-draft.md "verificar que cumplan INVEST"
```

## Instrucciones

1. **Validar entrada:** Extraer el nombre del archivo del primer argumento de `$ARGUMENTS`.
   Usar la herramienta **Read** para intentar leer el archivo.
   - Si el archivo no existe: informar al usuario y pedir la ruta correcta. No continuar.
   - Si el archivo está vacío o no contiene HUs reconocibles: informar al usuario.
2. Si hay instrucción adicional, usarla como foco del refinamiento
3. Ejecutar el workflow de refinamiento del skill `requirements-decomposition`:
   a. Leer las HUs proporcionadas
   b. Evaluar cada una contra INVEST y el checklist de refinamiento
   c. Identificar problemas agrupados por HU
   d. Proponer versiones mejoradas concretas (no solo señalar problemas)
   e. Confirmar cambios con el usuario
4. Generar archivo con las HUs refinadas

## Tipos de Refinamiento

El comando detecta automáticamente qué tipo de mejora necesita cada HU:

- **Narrativa débil** → Reescribir con rol, acción y beneficio claros
- **Gherkin ausente o vago** → Generar/mejorar criterios de aceptación
- **HU demasiado grande** → Proponer división con estrategia
- **Falta INVEST** → Evaluar y proponer correcciones
- **Reglas de negocio implícitas** → Hacer explícitas
- **Dependencias ocultas** → Identificar y documentar
- **Duplicación** → Señalar HUs que se solapan y proponer consolidación

## Salida

Generar un archivo `docs/analisis/refinamiento-[nombre-documento].md` con:
- Resumen de hallazgos (qué se encontró por categoría)
- Tabla comparativa: HU original vs HU refinada (para cada cambio)
- HUs refinadas completas
- Recomendaciones adicionales si las hay

Presentar resumen en chat y ofrecer el archivo para descarga.
