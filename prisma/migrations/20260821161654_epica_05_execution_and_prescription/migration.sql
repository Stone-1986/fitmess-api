-- DropIndex
DROP INDEX "subscriptions_athlete_plan_active_key";

-- AlterTable
ALTER TABLE "session_exercises" ADD COLUMN     "distance_meters" DOUBLE PRECISION,
ADD COLUMN     "duration_seconds" INTEGER,
ADD COLUMN     "load_kg" DOUBLE PRECISION,
ADD COLUMN     "reps" INTEGER,
ADD COLUMN     "sets" INTEGER;

-- CreateTable
CREATE TABLE "plan_instances" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_phases" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instance_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_weeks" (
    "id" TEXT NOT NULL,
    "instance_phase_id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instance_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_sessions" (
    "id" TEXT NOT NULL,
    "instance_week_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_session_exercises" (
    "id" TEXT NOT NULL,
    "instance_session_id" TEXT NOT NULL,
    "exercise_version_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "load_kg" DOUBLE PRECISION,
    "duration_seconds" INTEGER,
    "distance_meters" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instance_session_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_results" (
    "id" TEXT NOT NULL,
    "instance_session_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_exercise_results" (
    "id" TEXT NOT NULL,
    "session_result_id" TEXT NOT NULL,
    "instance_session_exercise_id" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,
    "load_kg" DOUBLE PRECISION,
    "duration_seconds" INTEGER,
    "distance_meters" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_exercise_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_feelings" (
    "id" TEXT NOT NULL,
    "instance_week_id" TEXT NOT NULL,
    "muscle_soreness" INTEGER NOT NULL,
    "motivation" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_feelings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_instances_subscription_id_key" ON "plan_instances"("subscription_id");

-- CreateIndex
CREATE INDEX "plan_instances_athlete_id_idx" ON "plan_instances"("athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "instance_phases_id_instance_id_key" ON "instance_phases"("id", "instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "instance_phases_instance_id_order_key" ON "instance_phases"("instance_id", "order");

-- CreateIndex
CREATE INDEX "instance_weeks_instance_phase_id_idx" ON "instance_weeks"("instance_phase_id");

-- CreateIndex
CREATE UNIQUE INDEX "instance_weeks_instance_id_week_number_key" ON "instance_weeks"("instance_id", "week_number");

-- CreateIndex
CREATE UNIQUE INDEX "instance_sessions_instance_week_id_order_key" ON "instance_sessions"("instance_week_id", "order");

-- CreateIndex
CREATE INDEX "instance_session_exercises_exercise_version_id_idx" ON "instance_session_exercises"("exercise_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "instance_session_exercises_instance_session_id_order_key" ON "instance_session_exercises"("instance_session_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "session_results_instance_session_id_key" ON "session_results"("instance_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_exercise_results_instance_session_exercise_id_key" ON "session_exercise_results"("instance_session_exercise_id");

-- CreateIndex
CREATE INDEX "session_exercise_results_session_result_id_idx" ON "session_exercise_results"("session_result_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_feelings_instance_week_id_key" ON "weekly_feelings"("instance_week_id");

-- AddForeignKey
ALTER TABLE "plan_instances" ADD CONSTRAINT "plan_instances_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_instances" ADD CONSTRAINT "plan_instances_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_instances" ADD CONSTRAINT "plan_instances_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_phases" ADD CONSTRAINT "instance_phases_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "plan_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_weeks" ADD CONSTRAINT "instance_weeks_instance_phase_id_instance_id_fkey" FOREIGN KEY ("instance_phase_id", "instance_id") REFERENCES "instance_phases"("id", "instance_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_sessions" ADD CONSTRAINT "instance_sessions_instance_week_id_fkey" FOREIGN KEY ("instance_week_id") REFERENCES "instance_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_session_exercises" ADD CONSTRAINT "instance_session_exercises_instance_session_id_fkey" FOREIGN KEY ("instance_session_id") REFERENCES "instance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_session_exercises" ADD CONSTRAINT "instance_session_exercises_exercise_version_id_fkey" FOREIGN KEY ("exercise_version_id") REFERENCES "exercise_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_instance_session_id_fkey" FOREIGN KEY ("instance_session_id") REFERENCES "instance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_results" ADD CONSTRAINT "session_results_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercise_results" ADD CONSTRAINT "session_exercise_results_session_result_id_fkey" FOREIGN KEY ("session_result_id") REFERENCES "session_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_exercise_results" ADD CONSTRAINT "session_exercise_results_instance_session_exercise_id_fkey" FOREIGN KEY ("instance_session_exercise_id") REFERENCES "instance_session_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_feelings" ADD CONSTRAINT "weekly_feelings_instance_week_id_fkey" FOREIGN KEY ("instance_week_id") REFERENCES "instance_weeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
