-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_athlete_id_idx" ON "subscriptions"("athlete_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_status_idx" ON "subscriptions"("plan_id", "status");

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- INDICE PARCIAL — agregado a mano (decision D-3 del plan de EPICA-04).
--
-- Prisma no expresa indices parciales en el schema declarativo, igual que
-- ocurrio con "exercises_name_lower_active_key" en EPICA-02.
--
-- Un @@unique([athlete_id, plan_id]) simple seria INCORRECTO: el par puede
-- repetirse legitimamente porque un atleta rechazado SI puede volver a
-- solicitar inscripcion al mismo plan (CA-012-3, decision confirmada por el
-- humano el 2026-08-20). Una fila REJECTED nunca colisiona con este indice.
--
-- Lo que el indice garantiza a nivel de base de datos: un atleta no puede
-- tener dos suscripciones simultaneas VIVAS al mismo plan (CA-012-2). Cierra
-- la ventana de carrera entre dos solicitudes concurrentes que el pre-check
-- de SubscriptionsService.create() no puede cubrir por si solo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "subscriptions_athlete_plan_active_key"
    ON "subscriptions" ("athlete_id", "plan_id")
    WHERE "status" IN ('PENDING', 'APPROVED', 'ACTIVE');
