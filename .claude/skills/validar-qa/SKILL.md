---
name: validar-qa
description: Re-ejecuta el agente QA de forma standalone — corre tests con cobertura, valida linting, revisa seguridad y actualiza outputs/reporte_qa.yaml. Usar cuando se necesite re-validar sin pasar por toda la cadena de implementación.
context: fork
agent: qa
---

# /validar-qa $ARGUMENTS

Invoca al agente QA para validación standalone.

## Uso

```
/validar-qa                                          # Ejecuta validación QA completa
/validar-qa "solo cobertura y linting"               # Tarea específica
/validar-qa "re-validar auth después del fix manual" # Contexto específico
```

## Instrucciones

1. **Leer los inputs necesarios:**
   - `src/` — código implementado por el Desarrollador
   - `outputs/plan_de_implementacion.yaml` — plan técnico (referencia del contrato aprobado)
   - `outputs/reporte_validacion_negocio.yaml` — validación funcional y legal
   - `outputs/reporte_qa.yaml` — reporte QA previo (si existe, para contexto)

2. **Si hay argumentos**, usarlos como instrucciones específicas de lo que se necesita re-validar
3. **Si no hay argumentos**, ejecutar el proceso QA completo (§1-§6 del agente)

4. **Ejecutar el proceso completo del agente QA:**
   - §1: Tests unitarios con cobertura (80% dominio, 70% adaptadores)
   - §2: Tests e2e
   - §3: Validación de linting (ESLint + Prettier)
   - §4: Revisión de seguridad y vulnerabilidades
   - §5: Checklists de calidad (excepciones, datos, Supabase, logging)
   - §6: Validación OpenAPI con Spectral

5. **Escribir el reporte en:** `outputs/reporte_qa.yaml`
6. Presentar resumen de resultados y cerrar con: "¿Necesitas ajustar algo en el reporte QA?"

## Importante

- Este comando **NO lanza** al Desarrollador ni al Líder Técnico
- Si se detectan errores, el reporte queda en `outputs/reporte_qa.yaml` para que el humano decida el siguiente paso
- Para lanzar la revisión del LT después, usar `/revisar-codigo`
