import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesController } from './exercises.controller.js';
import { ExercisesService } from './exercises.service.js';

const mockExercisesService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
};

describe('ExercisesController', () => {
  let controller: ExercisesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExercisesController],
      providers: [
        { provide: ExercisesService, useValue: mockExercisesService },
      ],
    }).compile();

    controller = module.get<ExercisesController>(ExercisesController);
  });

  afterEach(() => vi.clearAllMocks());

  describe('create()', () => {
    it('delega en el service y retorna el resultado sin modificarlo', async () => {
      const dto = {
        name: 'Sentadilla con barra',
        description: 'desc',
        muscleGroup: 'Cuadriceps',
      };
      const expected = { id: 'exercise-uuid', ...dto, versionNumber: 1 };
      mockExercisesService.create.mockResolvedValue(expected);

      const result = await controller.create(dto as never);

      expect(mockExercisesService.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });

  describe('findAll()', () => {
    it('delega en el service con el query recibido', async () => {
      const query = { page: 1, limit: 20, includeInactive: false };
      const expected = { data: [], meta: { page: 1, limit: 20 } };
      mockExercisesService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query as never);

      expect(mockExercisesService.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });

  describe('findOne()', () => {
    it('delega en el service con el id recibido', async () => {
      const id = 'exercise-uuid';
      const expected = { id, name: 'Sentadilla', versions: [] };
      mockExercisesService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(id);

      expect(mockExercisesService.findOne).toHaveBeenCalledWith(id);
      expect(result).toBe(expected);
    });
  });

  describe('update()', () => {
    it('delega en el service con id y dto', async () => {
      const id = 'exercise-uuid';
      const dto = { description: 'nueva descripcion' };
      const expected = { id, description: 'nueva descripcion' };
      mockExercisesService.update.mockResolvedValue(expected);

      const result = await controller.update(id, dto as never);

      expect(mockExercisesService.update).toHaveBeenCalledWith(id, dto);
      expect(result).toBe(expected);
    });
  });

  describe('deactivate()', () => {
    it('delega en el service con el id recibido', async () => {
      const id = 'exercise-uuid';
      const expected = {
        data: null,
        message: 'Ejercicio inhabilitado exitosamente',
      };
      mockExercisesService.deactivate.mockResolvedValue(expected);

      const result = await controller.deactivate(id);

      expect(mockExercisesService.deactivate).toHaveBeenCalledWith(id);
      expect(result).toBe(expected);
    });
  });
});
