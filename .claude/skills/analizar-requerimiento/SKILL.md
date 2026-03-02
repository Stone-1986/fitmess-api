---
name: analizar-requerimiento
description: Analiza un documento de requerimientos y genera Épicas, Features e Historias de Usuario con criterios Gherkin. Usar cuando se reciba un archivo de especificación funcional, acta de reunión, o documento de requisitos para descomponer en artefactos ágiles. Acepta un archivo y opcionalmente contexto adicional.
context: fork
agent: business-analyst
---

# /analizar-requerimiento $ARGUMENTS

Ejecutar el workflow completo de análisis de requerimientos.

## Uso

```
/analizar-requerimiento <archivo> [contexto opcional]
```

**Ejemplos:**
```
/analizar-requerimiento requirements.txt
/analizar-requerimiento specs/modulo-ventas.txt "ERP para distribuidora, actores: vendedor, supervisor, almacenista"
/analizar-requerimiento docs/acta-reunion.md
```

## Instrucciones

1. **Validar entrada:** Extraer el nombre del archivo del primer argumento de `$ARGUMENTS`.
   Usar la herramienta **Read** para intentar leer el archivo.
   - Si el archivo no existe: informar al usuario y pedir la ruta correcta. No continuar.
   - Si el archivo está vacío: informar al usuario. No continuar.
   - Si el archivo no es texto legible: informar y pedir un formato compatible (.txt, .md, .pdf).
2. Si hay texto adicional después del nombre del archivo, usarlo como contexto
   inicial del proyecto (saltar a confirmación rápida del Paso 0)
3. Si no hay contexto adicional, ejecutar el Paso 0 completo (descubrimiento)
4. Seguir el workflow completo definido en el skill `requirements-decomposition`
5. Generar el entregable final en `outputs/epica_input.yaml` siguiendo el schema `epica.schema.json`

### Múltiples documentos

Si el usuario proporciona varios archivos separados por espacio o coma:
1. Leer todos los archivos proporcionados
2. Consolidar la información en un único análisis
3. Cuando haya información contradictoria entre documentos, señalar la contradicción
   y preguntar al usuario cuál prevalece
4. Citar de qué documento proviene cada hallazgo en el Paso 1

## Comportamiento Esperado

- Ser interactivo: preguntar antes de asumir
- Adoptar el vocabulario del documento
- Mantenerse en el plano funcional (nunca técnico)
- Presentar en el chat: Resumen Ejecutivo, Mapa de Descomposición (árbol visual), Supuestos
- Escribir en archivo: la épica estructurada en YAML con todas las HUs

## Salida

Escribir `outputs/epica_input.yaml` con la estructura completa de la épica (schema: `.claude/schemas/epica.schema.json`).
Presentar en el chat el resumen ejecutivo, el mapa de descomposición y los supuestos.
Informar al usuario que puede validar el archivo con `pnpm run validate:epica outputs/epica_input.yaml`.
