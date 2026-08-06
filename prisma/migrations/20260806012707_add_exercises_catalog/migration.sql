-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_versions" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "muscle_group" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercises_is_active_idx" ON "exercises"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_versions_exercise_id_version_number_key" ON "exercise_versions"("exercise_id", "version_number");

-- AddForeignKey
ALTER TABLE "exercise_versions" ADD CONSTRAINT "exercise_versions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- ESCRITO A MANO — NO GENERADO POR PRISMA. NO BORRAR.
--
-- Unicidad del nombre de ejercicio: SOLO entre los ACTIVOS y sin distinguir
-- mayusculas (CA-005-2 y CA-005-6 de EPICA-02).
--
-- Prisma no puede expresar esto en schema.prisma: no soporta indices
-- funcionales (lower(...)) ni parciales (WHERE). Un `@@unique([name])`
-- declarativo seria INCORRECTO — rechazaria crear un ejercicio con el nombre
-- de uno inhabilitado, que la regla de negocio permite explicitamente.
--
-- Sin trim() a proposito: el service persiste `name` ya recortado, tanto en
-- create() como en el rename de update().
--
-- Si esta linea desaparece, nada falla de inmediato: simplemente dejan de
-- existir la garantia de unicidad a nivel de base de datos y la proteccion
-- contra la condicion de carrera entre dos altas concurrentes. Por eso
-- test/exercises.e2e-spec.ts verifica su comportamiento (que es unico y que
-- es parcial) como parte del gate de e2e.
-- ============================================================================
CREATE UNIQUE INDEX "exercises_name_lower_active_key"
  ON "exercises" (lower("name"))
  WHERE "is_active" = true;
