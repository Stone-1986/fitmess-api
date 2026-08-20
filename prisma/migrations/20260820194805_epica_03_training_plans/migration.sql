-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "coach_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_exercises" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "exercise_version_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plans_coach_id_idx" ON "plans"("coach_id");

-- CreateIndex
CREATE INDEX "plans_status_end_date_idx" ON "plans"("status", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "phases_id_plan_id_key" ON "phases"("id", "plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "phases_plan_id_order_key" ON "phases"("plan_id", "order");

-- CreateIndex
CREATE INDEX "weeks_phase_id_idx" ON "weeks"("phase_id");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_plan_id_week_number_key" ON "weeks"("plan_id", "week_number");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_week_id_order_key" ON "sessions"("week_id", "order");

-- CreateIndex
CREATE INDEX "session_exercises_exercise_version_id_idx" ON "session_exercises"("exercise_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_exercises_session_id_order_key" ON "session_exercises"("session_id", "order");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_phase_id_plan_id_fkey" FOREIGN KEY ("phase_id", "plan_id") REFERENCES "phases"("id", "plan_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_exercise_version_id_fkey" FOREIGN KEY ("exercise_version_id") REFERENCES "exercise_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
