import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesService } from './exercises.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';

/**
 * Mock de PrismaService — solo los metodos que usa ExercisesService.
 *
 * $transaction soporta ambas firmas usadas por el service: callback
 * (create(), interactive transaction) y array de promesas (findAll(), batch).
 */
const mockPrisma = {
  exercise: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  exerciseVersion: {
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn((arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mockPrisma) => unknown)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  }),
};

const EXERCISE_ID = 'exercise-uuid';

function buildExercise(overrides: Record<string, unknown> = {}) {
  return {
    id: EXERCISE_ID,
    name: 'Sentadilla con barra',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-uuid',
    exerciseId: EXERCISE_ID,
    versionNumber: 1,
    description: 'Descripcion original',
    muscleGroup: 'Cuadriceps',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ExercisesService', () => {
  let service: ExercisesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExercisesService>(ExercisesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── create() ──────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      name: '  Sentadilla con barra  ',
      description: '  Descripcion  ',
      muscleGroup: '  Cuadriceps  ',
    };

    it('crea Exercise + ExerciseVersion(1) en una $transaction y retorna trim() aplicado', async () => {
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.exercise.create.mockResolvedValue(buildExercise());
      mockPrisma.exerciseVersion.create.mockResolvedValue(
        buildVersion({ description: 'Descripcion', muscleGroup: 'Cuadriceps' }),
      );

      const result = await service.create(dto as never);

      expect(mockPrisma.exercise.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { equals: 'Sentadilla con barra', mode: 'insensitive' },
            isActive: true,
          }),
        }),
      );
      expect(mockPrisma.exercise.create).toHaveBeenCalledWith({
        data: { name: 'Sentadilla con barra' },
      });
      expect(mockPrisma.exerciseVersion.create).toHaveBeenCalledWith({
        data: {
          exerciseId: EXERCISE_ID,
          versionNumber: 1,
          description: 'Descripcion',
          muscleGroup: 'Cuadriceps',
        },
      });
      expect(result).toEqual({
        id: EXERCISE_ID,
        name: 'Sentadilla con barra',
        description: 'Descripcion',
        muscleGroup: 'Cuadriceps',
        versionNumber: 1,
        isActive: true,
        createdAt: buildExercise().createdAt,
        updatedAt: buildExercise().updatedAt,
      });
    });

    it('lanza DUPLICATE_ENTITY si ya existe un ejercicio ACTIVO con el mismo name (pre-check)', async () => {
      mockPrisma.exercise.findFirst.mockResolvedValue({ id: 'otro-uuid' });

      await expect(service.create(dto as never)).rejects.toMatchObject({
        errorEntry: BusinessError.DUPLICATE_ENTITY,
      });
      expect(mockPrisma.exercise.create).not.toHaveBeenCalled();
    });

    it('traduce P2002 (condicion de carrera) a DUPLICATE_ENTITY', async () => {
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementationOnce(() => {
        const error = Object.assign(new Error('Unique constraint'), {
          code: 'P2002',
        });
        return Promise.reject(error);
      });

      await expect(service.create(dto as never)).rejects.toMatchObject({
        errorEntry: BusinessError.DUPLICATE_ENTITY,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante un error de DB no-P2002', async () => {
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('conexion perdida')),
      );

      await expect(service.create(dto as never)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('filtra isActive=true por defecto y arma la meta de paginacion', async () => {
      mockPrisma.exercise.count.mockResolvedValue(1);
      mockPrisma.exercise.findMany.mockResolvedValue([
        { ...buildExercise(), versions: [buildVersion()] },
      ]);

      const result = await service.findAll({} as never);

      expect(mockPrisma.exercise.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(mockPrisma.exercise.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: EXERCISE_ID,
        versionNumber: 1,
        isActive: true,
      });
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      });
    });

    it('con includeInactive=true no filtra por isActive', async () => {
      mockPrisma.exercise.count.mockResolvedValue(0);
      mockPrisma.exercise.findMany.mockResolvedValue([]);

      await service.findAll({ includeInactive: true } as never);

      expect(mockPrisma.exercise.count).toHaveBeenCalledWith({ where: {} });
    });

    it('respeta page/limit enviados para el skip', async () => {
      mockPrisma.exercise.count.mockResolvedValue(50);
      mockPrisma.exercise.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 3, limit: 10 } as never);

      expect(mockPrisma.exercise.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.$transaction.mockImplementationOnce(() =>
        Promise.reject(new Error('timeout')),
      );

      await expect(service.findAll({} as never)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retorna el detalle con la version vigente y el historial completo', async () => {
      const v1 = buildVersion({ versionNumber: 1, description: 'V1' });
      const v2 = buildVersion({
        id: 'version-2',
        versionNumber: 2,
        description: 'V2',
      });
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [v1, v2],
      });

      const result = await service.findOne(EXERCISE_ID);

      expect(result.description).toBe('V2');
      expect(result.versionNumber).toBe(2);
      expect(result.versions).toEqual([
        { versionNumber: 1, createdAt: v1.createdAt },
        { versionNumber: 2, createdAt: v2.createdAt },
      ]);
    });

    it('retorna un ejercicio inhabilitado sin filtrarlo, con isActive=false visible (CA-007-3)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise({ isActive: false }),
        versions: [buildVersion()],
      });

      const result = await service.findOne(EXERCISE_ID);

      expect(result.isActive).toBe(false);
    });

    it('lanza ENTITY_NOT_FOUND si el ejercicio no existe', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null);

      await expect(service.findOne('inexistente')).rejects.toMatchObject({
        errorEntry: BusinessError.ENTITY_NOT_FOUND,
      });
    });
  });

  // ── update() ──────────────────────────────────────────────────────────

  describe('update()', () => {
    it('lanza ENTITY_NOT_FOUND si el ejercicio no existe (CA-006-4)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.update('inexistente', { description: 'x' } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.ENTITY_NOT_FOUND });
    });

    it('lanza EXERCISE_INACTIVE sin invocar isUsedInPlan si el ejercicio esta inhabilitado (CA-006-6)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise({ isActive: false }),
        versions: [buildVersion()],
      });
      const isUsedInPlanSpy = vi.spyOn(
        service as unknown as { isUsedInPlan: () => Promise<boolean> },
        'isUsedInPlan',
      );

      await expect(
        service.update(EXERCISE_ID, { description: 'nueva' } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.EXERCISE_INACTIVE });

      expect(isUsedInPlanSpy).not.toHaveBeenCalled();
      expect(mockPrisma.exerciseVersion.create).not.toHaveBeenCalled();
      expect(mockPrisma.exerciseVersion.update).not.toHaveBeenCalled();
    });

    it('lanza DUPLICATE_ENTITY si el nuevo name colisiona con otro ejercicio ACTIVO', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.findFirst.mockResolvedValue({ id: 'otro-uuid' });

      await expect(
        service.update(EXERCISE_ID, { name: 'Peso muerto' } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.DUPLICATE_ENTITY });

      expect(mockPrisma.exercise.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { equals: 'Peso muerto', mode: 'insensitive' },
            isActive: true,
            id: { not: EXERCISE_ID },
          }),
        }),
      );
    });

    it('excluye el propio id de la comparacion de unicidad en el rename', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.exercise.update.mockResolvedValue(
        buildExercise({ name: 'Sentadilla trasera' }),
      );

      await service.update(EXERCISE_ID, {
        name: 'Sentadilla trasera',
      } as never);

      expect(mockPrisma.exercise.update).toHaveBeenCalledWith({
        where: { id: EXERCISE_ID },
        data: { name: 'Sentadilla trasera' },
      });
    });

    it('permite el rename a un name que solo existe en un ejercicio INHABILITADO (CA-005-6)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      // La query de unicidad filtra isActive: true — un name que solo existe en un
      // ejercicio inhabilitado nunca aparece en este findFirst, asi que retorna null
      // y el rename procede sin DUPLICATE_ENTITY.
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.exercise.update.mockResolvedValue(
        buildExercise({ name: 'Nombre de un inhabilitado' }),
      );

      const result = await service.update(EXERCISE_ID, {
        name: 'Nombre de un inhabilitado',
      } as never);

      expect(mockPrisma.exercise.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { equals: 'Nombre de un inhabilitado', mode: 'insensitive' },
            isActive: true,
            id: { not: EXERCISE_ID },
          }),
        }),
      );
      expect(result.name).toBe('Nombre de un inhabilitado');
    });

    it('traduce P2002 del rename a DUPLICATE_ENTITY', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.exercise.update.mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
      );

      await expect(
        service.update(EXERCISE_ID, { name: 'Sentadilla trasera' } as never),
      ).rejects.toMatchObject({ errorEntry: BusinessError.DUPLICATE_ENTITY });
    });

    it('lanza TechnicalException DATABASE_ERROR si el rename falla por un error no-P2002', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.exercise.update.mockRejectedValue(new Error('DB caida'));

      await expect(
        service.update(EXERCISE_ID, { name: 'Sentadilla trasera' } as never),
      ).rejects.toThrow(TechnicalException);
    });

    it('isUsedInPlan() real (sin mockear) retorna false hoy — EPICA-03 reemplaza su cuerpo', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exerciseVersion.update.mockResolvedValue(
        buildVersion({ description: 'Actualizada' }),
      );

      const result = await service.update(EXERCISE_ID, {
        description: 'Actualizada',
      } as never);

      // false => edicion in-place (CA-006-3), no crea version nueva
      expect(mockPrisma.exerciseVersion.update).toHaveBeenCalled();
      expect(mockPrisma.exerciseVersion.create).not.toHaveBeenCalled();
      expect(result.versionNumber).toBe(1);
    });

    it('crea una ExerciseVersion nueva cuando isUsedInPlan() retorna true (CA-006-1)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion({ versionNumber: 2 })],
      });
      vi.spyOn(
        service as unknown as { isUsedInPlan: () => Promise<boolean> },
        'isUsedInPlan',
      ).mockResolvedValue(true);
      mockPrisma.exerciseVersion.create.mockResolvedValue(
        buildVersion({ id: 'version-3', versionNumber: 3 }),
      );

      const result = await service.update(EXERCISE_ID, {
        description: 'Descripcion actualizada',
      } as never);

      expect(mockPrisma.exerciseVersion.create).toHaveBeenCalledWith({
        data: {
          exerciseId: EXERCISE_ID,
          versionNumber: 3,
          description: 'Descripcion actualizada',
          muscleGroup: 'Cuadriceps',
        },
      });
      expect(mockPrisma.exerciseVersion.update).not.toHaveBeenCalled();
      expect(result.versionNumber).toBe(3);
    });

    it('edita la ExerciseVersion vigente in-place cuando isUsedInPlan() retorna false (CA-006-3)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      vi.spyOn(
        service as unknown as { isUsedInPlan: () => Promise<boolean> },
        'isUsedInPlan',
      ).mockResolvedValue(false);
      mockPrisma.exerciseVersion.update.mockResolvedValue(
        buildVersion({ description: 'Descripcion actualizada' }),
      );

      const result = await service.update(EXERCISE_ID, {
        description: 'Descripcion actualizada',
      } as never);

      expect(mockPrisma.exerciseVersion.update).toHaveBeenCalledWith({
        where: { id: 'version-uuid' },
        data: {
          description: 'Descripcion actualizada',
          muscleGroup: 'Cuadriceps',
        },
      });
      expect(mockPrisma.exerciseVersion.create).not.toHaveBeenCalled();
      expect(result.description).toBe('Descripcion actualizada');
    });

    it('no toca ExerciseVersion si el DTO no envia description ni muscleGroup', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.findFirst.mockResolvedValue(null);
      mockPrisma.exercise.update.mockResolvedValue(
        buildExercise({ name: 'Nuevo nombre' }),
      );

      await service.update(EXERCISE_ID, { name: 'Nuevo nombre' } as never);

      expect(mockPrisma.exerciseVersion.create).not.toHaveBeenCalled();
      expect(mockPrisma.exerciseVersion.update).not.toHaveBeenCalled();
    });

    it('lanza TechnicalException si falla la escritura de ExerciseVersion', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      vi.spyOn(
        service as unknown as { isUsedInPlan: () => Promise<boolean> },
        'isUsedInPlan',
      ).mockResolvedValue(false);
      mockPrisma.exerciseVersion.update.mockRejectedValue(
        new Error('DB caida'),
      );

      await expect(
        service.update(EXERCISE_ID, { description: 'x' } as never),
      ).rejects.toThrow(TechnicalException);
    });
  });

  // ── deactivate() ──────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('inhabilita un ejercicio activo y retorna { data: null, message }', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.update.mockResolvedValue(
        buildExercise({ isActive: false }),
      );

      const result = await service.deactivate(EXERCISE_ID);

      expect(mockPrisma.exercise.update).toHaveBeenCalledWith({
        where: { id: EXERCISE_ID },
        data: { isActive: false },
      });
      expect(result).toEqual({
        data: null,
        message: 'Ejercicio inhabilitado exitosamente',
      });
    });

    it('SIEMPRE procede, nunca lanza EXERCISE_IN_USE (CA-007-1)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.update.mockResolvedValue(
        buildExercise({ isActive: false }),
      );

      await expect(service.deactivate(EXERCISE_ID)).resolves.toBeDefined();
    });

    it('lanza EXERCISE_INACTIVE si el ejercicio ya estaba inhabilitado (CA-007-4)', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise({ isActive: false }),
        versions: [buildVersion()],
      });

      await expect(service.deactivate(EXERCISE_ID)).rejects.toMatchObject({
        errorEntry: BusinessError.EXERCISE_INACTIVE,
      });
      expect(mockPrisma.exercise.update).not.toHaveBeenCalled();
    });

    it('lanza ENTITY_NOT_FOUND si el ejercicio no existe', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('inexistente')).rejects.toMatchObject({
        errorEntry: BusinessError.ENTITY_NOT_FOUND,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR ante fallo de DB', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValue({
        ...buildExercise(),
        versions: [buildVersion()],
      });
      mockPrisma.exercise.update.mockRejectedValue(new Error('DB caida'));

      await expect(service.deactivate(EXERCISE_ID)).rejects.toThrow(
        TechnicalException,
      );
    });
  });

  // ── isPrismaUniqueConstraintError() (via create/update — cubierto arriba) ─

  it('BusinessException se lanza como instancia real (no solo el shape)', async () => {
    mockPrisma.exercise.findFirst.mockResolvedValue({ id: 'otro-uuid' });

    await expect(
      service.create({
        name: 'Duplicado',
        description: 'd',
        muscleGroup: 'm',
      } as never),
    ).rejects.toThrow(BusinessException);
  });
});
