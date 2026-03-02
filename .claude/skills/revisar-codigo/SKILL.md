---
name: revisar-codigo
description: Re-ejecuta el Líder Técnico de forma standalone — revisa linting, patrones, consistencia código↔contrato y analiza el reporte del QA. Actualiza outputs/revision_codigo.yaml. Usar cuando se necesite re-revisar sin pasar por toda la cadena de implementación.
context: fork
agent: lider-tecnico
---

# /revisar-codigo $ARGUMENTS

Invoca al agente Líder Técnico para revisión de código standalone.

## Uso

```
/revisar-codigo                                           # Ejecuta revisión completa
/revisar-codigo "revisar solo patrones de auth"           # Revisión focalizada
/revisar-codigo "re-revisar después del fix del ciclo 2"  # Contexto específico
```

## Instrucciones

1. **Leer los inputs necesarios:**
   - `outputs/reporte_qa.yaml` — reporte del QA con errores detectados
   - `src/` — código implementado por el Desarrollador
   - `outputs/plan_de_implementacion.yaml` — plan técnico (referencia del contrato aprobado)
   - `outputs/revision_codigo.yaml` — revisión previa (si existe, para contexto)

2. **Si hay argumentos**, usarlos como instrucciones específicas de lo que se necesita re-revisar
3. **Si no hay argumentos**, ejecutar el proceso LT completo (§1-§5 del agente)

4. **Ejecutar el proceso completo del Líder Técnico:**
   - §1: Revisar resultados de linting y cobertura
   - §1.5: Analizar resultados de validación OpenAPI (Spectral)
   - §2: Revisar violaciones de patrones
   - §3: Validar consistencia código↔contrato
   - §4: Analizar errores críticos del QA y escaneo automatizado

5. **Escribir la revisión en:** `outputs/revision_codigo.yaml`
6. Presentar resumen de resultados y cerrar con: "¿Necesitas ajustar algo en la revisión?"

## Importante

- Este comando **NO lanza** al Desarrollador ni al QA
- Si se detectan errores, la revisión queda en `outputs/revision_codigo.yaml` para que el humano decida el siguiente paso
- Para lanzar la validación QA antes, usar `/validar-qa`
