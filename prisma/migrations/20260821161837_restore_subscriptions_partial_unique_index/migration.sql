-- ─────────────────────────────────────────────────────────────────────────────
-- RESTAURACION del indice unico parcial de EPICA-04, eliminado por accidente.
--
-- QUE PASO: la migracion 20260821161654_epica_05_execution_and_prescription
-- abre con `DROP INDEX "subscriptions_athlete_plan_active_key"`. Ese DROP lo
-- genero Prisma Migrate solo, sin que nadie lo pidiera, al diffear el schema
-- de EPICA-05 contra la base.
--
-- POR QUE IMPORTA: ese indice es la salvaguarda de base de datos de CA-012-2
-- (un atleta no puede tener dos suscripciones simultaneas VIVAS al mismo
-- plan). El pre-check de SubscriptionsService.create() cubre el caso comun,
-- pero no la ventana de carrera entre su SELECT y el INSERT: dos solicitudes
-- concurrentes del mismo atleta al mismo plan pasan ambas el pre-check. Sin
-- el indice, esa carrera queda abierta y el catch de P2002 del service no
-- tiene nada que atrapar.
--
-- CORRIGE UNA AFIRMACION FALSA DEL SCHEMA: el comentario de `Subscription` en
-- prisma/schema.prisma afirma "Sobrevivencia ante un futuro `prisma migrate
-- dev`: SI sobrevive [...] el motor de diff de Prisma Migrate no reconoce
-- indices parciales como 'propios' del schema declarativo, asi que nunca
-- genera un DROP INDEX para este". Es incorrecto y quedo demostrado el
-- 2026-08-21: lo dropeo en la primera migracion posterior. El indice
-- equivalente de EPICA-02, "exercises_name_lower_active_key", SI sobrevivio
-- la misma migracion, asi que el comportamiento no es uniforme y no puede
-- darse por sentado.
--
-- CONSECUENCIA OPERATIVA: verificar la presencia de este indice DESPUES de
-- cada `prisma migrate dev`, y restaurarlo con una migracion como esta si
-- vuelve a desaparecer:
--   SELECT indexname FROM pg_indexes
--    WHERE schemaname='public' AND indexname LIKE '%_active_key';
--
-- Verificado antes de aplicar: cero duplicados vivos de (athlete_id, plan_id)
-- entre las suscripciones en PENDING/APPROVED/ACTIVE, asi que la creacion del
-- indice unico no puede fallar por datos preexistentes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "subscriptions_athlete_plan_active_key"
    ON "subscriptions" ("athlete_id", "plan_id")
    WHERE "status" IN ('PENDING', 'APPROVED', 'ACTIVE');
