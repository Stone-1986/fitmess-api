import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Exercise, ExerciseVersion } from '../../../generated/prisma/index.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { TechnicalError } from '../common/exceptions/technical-error.enum.js';
import { PaginationMeta } from '../common/interceptors/response.interceptor.js';
import { CreateExerciseDto } from './dto/create-exercise.dto.js';
import { UpdateExerciseDto } from './dto/update-exercise.dto.js';
import { ListExercisesQueryDto } from './dto/list-exercises-query.dto.js';
import { ExerciseResponseDto } from './dto/exercise-response.dto.js';
import { ExerciseSummaryResponseDto } from './dto/exercise-summary-response.dto.js';
import { ExerciseDetailResponseDto } from './dto/exercise-detail-response.dto.js';

/**
 * ExercisesService — biblioteca global de ejercicios (EPICA-02).
 *
 * HU-005 (create/findAll), HU-006 (findOne/update), HU-007 (deactivate).
 * Exercise + ExerciseVersion es un unico agregado (design-patterns skill §1):
 * name vive en Exercise (identidad del catalogo, no versionado), description
 * y muscleGroup viven en ExerciseVersion (contenido versionado, RN-05).
 */
@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * HU-005: Crea Exercise + su primera ExerciseVersion (versionNumber = 1) en
   * una sola $transaction atomica (CA-005-1) — un Exercise sin ninguna version
   * es un estado invalido del dominio. isActive queda en true por defecto
   * (default del schema).
   *
   * Verifica previamente que no exista otro ejercicio ACTIVO con el mismo
   * name (case-insensitive, con trim) y rechaza con DUPLICATE_ENTITY si lo
   * hay (CA-005-2). Un name que solo existe en ejercicios inhabilitados NO
   * bloquea la creacion (CA-005-6).
   */
  async create(dto: CreateExerciseDto): Promise<ExerciseResponseDto> {
    const name = dto.name.trim();
    const description = dto.description.trim();
    const muscleGroup = dto.muscleGroup.trim();

    await this.ensureNameNotDuplicated(name);

    let exercise: Exercise;
    let version: ExerciseVersion;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const newExercise = await tx.exercise.create({ data: { name } });
        const newVersion = await tx.exerciseVersion.create({
          data: {
            exerciseId: newExercise.id,
            versionNumber: 1,
            description,
            muscleGroup,
          },
        });
        return { newExercise, newVersion };
      });

      exercise = created.newExercise;
      version = created.newVersion;
    } catch (error) {
      // Red de seguridad ante condiciones de carrera: el pre-check de arriba
      // no cierra la ventana entre dos requests concurrentes con el mismo
      // name — el indice unico parcial de Postgres (a cargo del DBA) es la
      // garantia real, y P2002 la traduce a un 409 de negocio claro.
      if (this.isPrismaUniqueConstraintError(error)) {
        throw new BusinessException(
          BusinessError.DUPLICATE_ENTITY,
          `Ya existe un ejercicio activo con el nombre '${name}'`,
          { entity: 'Exercise', name },
        );
      }
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al crear el ejercicio',
        {},
        error as Error,
      );
    }

    return this.toResponseDto(exercise, version);
  }

  /**
   * HU-005 (CA-005-3) + HU-007 (CA-007-2): Lista el catalogo con la version
   * vigente embebida (mayor versionNumber). Por defecto filtra isActive=true;
   * con includeInactive=true tambien incluye inhabilitados.
   */
  async findAll(
    query: ListExercisesQueryDto,
  ): Promise<{ data: ExerciseSummaryResponseDto[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const includeInactive = query.includeInactive ?? false;
    const skip = (page - 1) * limit;

    const where = includeInactive ? {} : { isActive: true };

    let total: number;
    let exercises: Array<Exercise & { versions: ExerciseVersion[] }>;

    try {
      [total, exercises] = await this.prisma.$transaction([
        this.prisma.exercise.count({ where }),
        this.prisma.exercise.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        }),
      ]);
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al listar el catalogo de ejercicios',
        {},
        error as Error,
      );
    }

    const data: ExerciseSummaryResponseDto[] = exercises.map((exercise) => {
      const currentVersion = exercise.versions[0];
      return {
        id: exercise.id,
        name: exercise.name,
        description: currentVersion.description,
        muscleGroup: currentVersion.muscleGroup,
        versionNumber: currentVersion.versionNumber,
        isActive: exercise.isActive,
        createdAt: exercise.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    const meta: PaginationMeta = {
      page,
      limit,
      totalItems: total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };

    return { data, meta };
  }

  /**
   * HU-006 (CA-006-2) + HU-007 (CA-007-3): Retorna el detalle de un
   * ejercicio con la version vigente mas el historial completo de
   * versiones. NO filtra por isActive — un ejercicio inhabilitado se lee
   * igual, con su estado visible.
   */
  async findOne(id: string): Promise<ExerciseDetailResponseDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'asc' } },
      },
    });

    if (!exercise) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Ejercicio con id '${id}' no fue encontrado`,
        { entity: 'Exercise', identifier: id },
      );
    }

    const currentVersion = exercise.versions[exercise.versions.length - 1];

    return {
      id: exercise.id,
      name: exercise.name,
      isActive: exercise.isActive,
      description: currentVersion.description,
      muscleGroup: currentVersion.muscleGroup,
      versionNumber: currentVersion.versionNumber,
      versions: exercise.versions.map((v) => ({
        versionNumber: v.versionNumber,
        createdAt: v.createdAt,
      })),
      createdAt: exercise.createdAt,
      updatedAt: exercise.updatedAt,
    };
  }

  /**
   * HU-006: Actualiza un ejercicio existente.
   *
   * Orden de validaciones (no reordenar — ver plan de implementacion):
   * (1) findOrFail — 404 si no existe (CA-006-4);
   * (2) si isActive=false, rechaza con EXERCISE_INACTIVE (422) sin crear
   *     version nueva ni alterar la vigente (CA-006-6). Va ANTES de
   *     isUsedInPlan() para no gastar esa consulta en un camino que de
   *     todos modos rechaza;
   * (3) si se envia name, valida unicidad case-insensitive + trim contra
   *     otros ejercicios ACTIVOS (excluyendo el propio) — DUPLICATE_ENTITY
   *     si colisiona;
   * (4) si se envia description y/o muscleGroup, decide entre crear una
   *     ExerciseVersion nueva (CA-006-1) o editar la vigente in-place
   *     (CA-006-3) segun isUsedInPlan(exerciseId).
   */
  async update(
    id: string,
    dto: UpdateExerciseDto,
  ): Promise<ExerciseResponseDto> {
    const exercise = await this.findExerciseOrFail(id);

    if (!exercise.isActive) {
      throw new BusinessException(
        BusinessError.EXERCISE_INACTIVE,
        `El ejercicio con id '${id}' esta inhabilitado y no admite modificaciones`,
        { entity: 'Exercise', identifier: id },
      );
    }

    let name = exercise.name;

    if (dto.name !== undefined) {
      name = dto.name.trim();
      await this.ensureNameNotDuplicated(name, id);
    }

    const currentVersion = exercise.versions[0];
    let version = currentVersion;

    const hasVersionedChanges =
      dto.description !== undefined || dto.muscleGroup !== undefined;

    if (hasVersionedChanges) {
      const description = dto.description?.trim() ?? currentVersion.description;
      const muscleGroup = dto.muscleGroup?.trim() ?? currentVersion.muscleGroup;

      const usedInPlan = await this.isUsedInPlan(id);

      try {
        if (usedInPlan) {
          version = await this.prisma.exerciseVersion.create({
            data: {
              exerciseId: id,
              versionNumber: currentVersion.versionNumber + 1,
              description,
              muscleGroup,
            },
          });
        } else {
          version = await this.prisma.exerciseVersion.update({
            where: { id: currentVersion.id },
            data: { description, muscleGroup },
          });
        }
      } catch (error) {
        throw new TechnicalException(
          TechnicalError.DATABASE_ERROR,
          'Error al actualizar el contenido del ejercicio',
          {},
          error as Error,
        );
      }
    }

    let updatedExercise: Exercise = exercise;

    if (dto.name !== undefined) {
      try {
        updatedExercise = await this.prisma.exercise.update({
          where: { id },
          data: { name },
        });
      } catch (error) {
        if (this.isPrismaUniqueConstraintError(error)) {
          throw new BusinessException(
            BusinessError.DUPLICATE_ENTITY,
            `Ya existe un ejercicio activo con el nombre '${name}'`,
            { entity: 'Exercise', name },
          );
        }
        throw new TechnicalException(
          TechnicalError.DATABASE_ERROR,
          'Error al actualizar el nombre del ejercicio',
          {},
          error as Error,
        );
      }
    }

    return this.toResponseDto(updatedExercise, version);
  }

  /**
   * HU-007: Inhabilita un ejercicio (isActive=false). Soft-delete propio de
   * ejercicios. SIEMPRE procede si el ejercicio esta activo, este o no en
   * uso — NUNCA se bloquea con EXERCISE_IN_USE (CA-007-1). Si ya estaba
   * inhabilitado, rechaza con EXERCISE_INACTIVE (CA-007-4).
   */
  async deactivate(id: string): Promise<{ data: null; message: string }> {
    const exercise = await this.findExerciseOrFail(id);

    if (!exercise.isActive) {
      throw new BusinessException(
        BusinessError.EXERCISE_INACTIVE,
        `El ejercicio con id '${id}' ya estaba inhabilitado`,
        { entity: 'Exercise', identifier: id },
      );
    }

    try {
      await this.prisma.exercise.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      throw new TechnicalException(
        TechnicalError.DATABASE_ERROR,
        'Error al inhabilitar el ejercicio',
        {},
        error as Error,
      );
    }

    return { data: null, message: 'Ejercicio inhabilitado exitosamente' };
  }

  /**
   * Punto de integracion con EPICA-03 (planes). HOY siempre retorna false
   * porque no existe tabla de planes contra la cual resolver la consulta.
   *
   * EPICA-03 debe reemplazar UNICAMENTE el cuerpo de este metodo por una
   * query real, por ejemplo:
   *   const count = await this.prisma.planExercise.count({
   *     where: { exerciseVersion: { exerciseId } },
   *   });
   *   return count > 0;
   * (o el nombre de tabla que defina el DBA de EPICA-03), sin tocar ninguna
   * otra linea de update().
   */
  private isUsedInPlan(exerciseId: string): Promise<boolean> {
    void exerciseId;
    return Promise.resolve(false);
  }

  /**
   * Busca un ejercicio con su version vigente (mayor versionNumber) y
   * lanza ENTITY_NOT_FOUND si no existe (CA-006-4). Reutilizado por
   * update() y deactivate().
   */
  private async findExerciseOrFail(
    id: string,
  ): Promise<Exercise & { versions: ExerciseVersion[] }> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!exercise) {
      throw new BusinessException(
        BusinessError.ENTITY_NOT_FOUND,
        `Ejercicio con id '${id}' no fue encontrado`,
        { entity: 'Exercise', identifier: id },
      );
    }

    return exercise;
  }

  /**
   * Unicidad de name solo entre ejercicios ACTIVOS (CA-005-2/CA-005-6),
   * case-insensitive y con el valor ya normalizado (trim) por el llamador.
   * excludeId se usa en el rename de update() para no comparar el ejercicio
   * contra si mismo.
   */
  private async ensureNameNotDuplicated(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const where: Record<string, unknown> = {
      name: { equals: name, mode: 'insensitive' },
      isActive: true,
    };

    if (excludeId) {
      where['id'] = { not: excludeId };
    }

    const existing = await this.prisma.exercise.findFirst({
      where,
      select: { id: true },
    });

    if (existing) {
      throw new BusinessException(
        BusinessError.DUPLICATE_ENTITY,
        `Ya existe un ejercicio activo con el nombre '${name}'`,
        { entity: 'Exercise', name },
      );
    }
  }

  /** Detecta errores de constraint unico de Prisma (P2002). */
  private isPrismaUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }

  private toResponseDto(
    exercise: Exercise,
    version: ExerciseVersion,
  ): ExerciseResponseDto {
    return {
      id: exercise.id,
      name: exercise.name,
      description: version.description,
      muscleGroup: version.muscleGroup,
      versionNumber: version.versionNumber,
      isActive: exercise.isActive,
      createdAt: exercise.createdAt,
      updatedAt: exercise.updatedAt,
    };
  }
}
