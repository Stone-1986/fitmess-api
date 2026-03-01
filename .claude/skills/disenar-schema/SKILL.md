---
name: disenar-schema
description: Invoca al agente DBA para diseñar o modificar el schema Prisma de forma standalone. Usar cuando se necesite trabajo de base de datos fuera del flujo de planificación — agregar modelos, índices, constraints, revisar relaciones, o preparar el schema para una migración. No requiere outputs de Fase 1.
context: fork
agent: dba
---

# /disenar-schema $ARGUMENTS

Invoca al agente DBA para trabajo de base de datos standalone.

## Uso

```
/disenar-schema                                    # Revisión general del schema actual
/disenar-schema "agregar modelo Notification"      # Tarea específica
/disenar-schema "revisar índices de coach_requests" # Revisión puntual
```

## Instrucciones

1. **Leer el schema actual:** `prisma/schema.prisma`
2. **Si hay argumentos**, usarlos como instrucciones específicas de lo que se necesita
3. **Si no hay argumentos**, hacer una revisión general del schema y presentar recomendaciones
4. **Si existe** `outputs/plan_de_implementacion.yaml`, usarlo como contexto adicional (pero no es obligatorio en modo standalone)
5. Ejecutar el proceso completo del agente DBA
6. Escribir los cambios en `prisma/schema.prisma`
7. Presentar resumen de cambios y cerrar con: "¿Necesitas ajustar algo en el schema?"

## Después de la ejecución

El humano debe ejecutar:

```bash
pnpm prisma migrate dev --name [descripcion-del-cambio]
pnpm prisma generate
```
