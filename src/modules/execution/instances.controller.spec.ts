import { Test, TestingModule } from '@nestjs/testing';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';

/**
 * InstancesController es THIN (rulesCodigo §Controllers): solo delega al
 * service y retorna el resultado sin modificarlo. Estos tests verifican
 * exactamente eso para los 5 endpoints de /instances — nada de logica de
 * negocio se prueba aqui (ya cubierta en instances.service.spec.ts).
 */
const mockInstancesService = {
  findAll: vi.fn(),
  findOwn: vi.fn(),
  findForCoach: vi.fn(),
  registerSessionResult: vi.fn(),
  registerWeeklyFeeling: vi.fn(),
};

const ATHLETE_USER = {
  id: 'athlete-uuid',
  email: 'athlete@test.com',
  role: 'ATHLETE',
};
const COACH_USER = { id: 'coach-uuid', email: 'coach@test.com', role: 'COACH' };

describe('InstancesController', () => {
  let controller: InstancesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstancesController],
      providers: [
        { provide: InstancesService, useValue: mockInstancesService },
      ],
    }).compile();

    controller = module.get<InstancesController>(InstancesController);
  });

  afterEach(() => vi.clearAllMocks());

  describe('findAll()', () => {
    it('delega en el service con el id del atleta y la paginacion', async () => {
      const expected = { data: [], meta: {} };
      mockInstancesService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(ATHLETE_USER as never, 2, 10);

      expect(mockInstancesService.findAll).toHaveBeenCalledWith(
        ATHLETE_USER.id,
        2,
        10,
      );
      expect(result).toBe(expected);
    });
  });

  describe('findOne()', () => {
    it('delega en el service con el id del atleta y el planId', async () => {
      const expected = { id: 'instance-uuid', phases: [] };
      mockInstancesService.findOwn.mockResolvedValue(expected);

      const result = await controller.findOne(
        ATHLETE_USER as never,
        'plan-uuid',
      );

      expect(mockInstancesService.findOwn).toHaveBeenCalledWith(
        ATHLETE_USER.id,
        'plan-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('findForCoach()', () => {
    it('delega en el service con el id del coach, el planId y el athleteId', async () => {
      const expected = { id: 'instance-uuid', phases: [] };
      mockInstancesService.findForCoach.mockResolvedValue(expected);

      const result = await controller.findForCoach(
        COACH_USER as never,
        'plan-uuid',
        'athlete-uuid',
      );

      expect(mockInstancesService.findForCoach).toHaveBeenCalledWith(
        COACH_USER.id,
        'plan-uuid',
        'athlete-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('registerSessionResult()', () => {
    it('delega en el service con el id del atleta, planId, sessionId y el dto', async () => {
      const dto = { exercises: [{ sessionExerciseId: 'ise-1', sets: 4 }] };
      const expected = { id: 'result-uuid', exerciseResults: [] };
      mockInstancesService.registerSessionResult.mockResolvedValue(expected);

      const result = await controller.registerSessionResult(
        ATHLETE_USER as never,
        'plan-uuid',
        'session-uuid',
        dto as never,
      );

      expect(mockInstancesService.registerSessionResult).toHaveBeenCalledWith(
        ATHLETE_USER.id,
        'plan-uuid',
        'session-uuid',
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('registerWeeklyFeeling()', () => {
    it('delega en el service con el id del atleta, planId, weekId y el dto', async () => {
      const dto = { muscleSoreness: 4, motivation: 8 };
      const expected = { id: 'feeling-uuid', muscleSoreness: 4, motivation: 8 };
      mockInstancesService.registerWeeklyFeeling.mockResolvedValue(expected);

      const result = await controller.registerWeeklyFeeling(
        ATHLETE_USER as never,
        'plan-uuid',
        'week-uuid',
        dto as never,
      );

      expect(mockInstancesService.registerWeeklyFeeling).toHaveBeenCalledWith(
        ATHLETE_USER.id,
        'plan-uuid',
        'week-uuid',
        dto,
      );
      expect(result).toBe(expected);
    });
  });
});
