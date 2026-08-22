import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * PlansController es THIN (rulesCodigo §Controllers): solo delega al service
 * y retorna el resultado sin modificarlo. Estos tests verifican exactamente
 * eso para los 15 endpoints de /plans — nada de logica de negocio se prueba
 * aqui (ya cubierta en plans.service.spec.ts).
 */
const mockPlansService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  addPhase: vi.fn(),
  removePhase: vi.fn(),
  addWeek: vi.fn(),
  removeWeek: vi.fn(),
  addSession: vi.fn(),
  removeSession: vi.fn(),
  addSessionExercise: vi.fn(),
  updateSessionExercisePrescription: vi.fn(),
  removeSessionExercise: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  archive: vi.fn(),
};

const USER = { id: 'coach-uuid', email: 'coach@test.com', role: 'COACH' };

describe('PlansController', () => {
  let controller: PlansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        { provide: PlansService, useValue: mockPlansService },
        // PlanPublishedGuard (@UseGuards a nivel de metodo en 10 rutas de
        // estructura) depende de PrismaService — Nest lo instancia via DI al
        // compilar el modulo de test aunque el guard nunca se ejecute en
        // estas pruebas (no pasan por el pipeline HTTP). Su comportamiento
        // esta cubierto por separado en plan-published.guard.spec.ts.
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PlansController>(PlansController);
  });

  afterEach(() => vi.clearAllMocks());

  describe('create()', () => {
    it('delega en el service con el id del usuario y el dto', async () => {
      const dto = { name: 'Plan' };
      const expected = { id: 'plan-uuid', name: 'Plan' };
      mockPlansService.create.mockResolvedValue(expected);

      const result = await controller.create(USER as never, dto as never);

      expect(mockPlansService.create).toHaveBeenCalledWith(USER.id, dto);
      expect(result).toBe(expected);
    });
  });

  describe('findAll()', () => {
    it('delega en el service con el id del usuario y la paginacion', async () => {
      const expected = { data: [], meta: {} };
      mockPlansService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(USER as never, 2, 10);

      expect(mockPlansService.findAll).toHaveBeenCalledWith(USER.id, 2, 10);
      expect(result).toBe(expected);
    });
  });

  describe('findOne()', () => {
    it('delega en el service con el id del usuario y el id del plan', async () => {
      const expected = { id: 'plan-uuid', phases: [] };
      mockPlansService.findOne.mockResolvedValue(expected);

      const result = await controller.findOne(USER as never, 'plan-uuid');

      expect(mockPlansService.findOne).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('update()', () => {
    it('delega en el service con id de usuario, id de plan y dto', async () => {
      const dto = { name: 'Renombrado' };
      const expected = { id: 'plan-uuid', name: 'Renombrado' };
      mockPlansService.update.mockResolvedValue(expected);

      const result = await controller.update(
        USER as never,
        'plan-uuid',
        dto as never,
      );

      expect(mockPlansService.update).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('addPhase()', () => {
    it('delega en el service', async () => {
      const dto = { name: 'Fase 1' };
      const expected = { id: 'phase-uuid' };
      mockPlansService.addPhase.mockResolvedValue(expected);

      const result = await controller.addPhase(
        USER as never,
        'plan-uuid',
        dto as never,
      );

      expect(mockPlansService.addPhase).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('removePhase()', () => {
    it('delega en el service', async () => {
      const expected = { data: null, message: 'Fase eliminada exitosamente' };
      mockPlansService.removePhase.mockResolvedValue(expected);

      const result = await controller.removePhase(
        USER as never,
        'plan-uuid',
        'phase-uuid',
      );

      expect(mockPlansService.removePhase).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'phase-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('addWeek()', () => {
    it('delega en el service', async () => {
      const expected = { id: 'week-uuid', weekNumber: 1 };
      mockPlansService.addWeek.mockResolvedValue(expected);

      const result = await controller.addWeek(
        USER as never,
        'plan-uuid',
        'phase-uuid',
      );

      expect(mockPlansService.addWeek).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'phase-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('removeWeek()', () => {
    it('delega en el service', async () => {
      const expected = {
        data: null,
        message: 'Semana eliminada exitosamente',
      };
      mockPlansService.removeWeek.mockResolvedValue(expected);

      const result = await controller.removeWeek(
        USER as never,
        'plan-uuid',
        'week-uuid',
      );

      expect(mockPlansService.removeWeek).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'week-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('addSession()', () => {
    it('delega en el service', async () => {
      const dto = { name: 'Dia 1' };
      const expected = { id: 'session-uuid' };
      mockPlansService.addSession.mockResolvedValue(expected);

      const result = await controller.addSession(
        USER as never,
        'plan-uuid',
        'week-uuid',
        dto as never,
      );

      expect(mockPlansService.addSession).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'week-uuid',
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('removeSession()', () => {
    it('delega en el service', async () => {
      const expected = {
        data: null,
        message: 'Sesion eliminada exitosamente',
      };
      mockPlansService.removeSession.mockResolvedValue(expected);

      const result = await controller.removeSession(
        USER as never,
        'plan-uuid',
        'session-uuid',
      );

      expect(mockPlansService.removeSession).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'session-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('addSessionExercise()', () => {
    it('delega en el service', async () => {
      const dto = { exerciseId: 'exercise-uuid' };
      const expected = { id: 'session-exercise-uuid' };
      mockPlansService.addSessionExercise.mockResolvedValue(expected);

      const result = await controller.addSessionExercise(
        USER as never,
        'plan-uuid',
        'session-uuid',
        dto as never,
      );

      expect(mockPlansService.addSessionExercise).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'session-uuid',
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('updateSessionExercisePrescription()', () => {
    it('delega en el service (D-15, PATCH .../exercises/:sessionExerciseId)', async () => {
      const dto = { sets: 4, reps: 10 };
      const expected = { id: 'session-exercise-uuid', sets: 4, reps: 10 };
      mockPlansService.updateSessionExercisePrescription.mockResolvedValue(
        expected,
      );

      const result = await controller.updateSessionExercisePrescription(
        USER as never,
        'plan-uuid',
        'session-uuid',
        'session-exercise-uuid',
        dto as never,
      );

      expect(
        mockPlansService.updateSessionExercisePrescription,
      ).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'session-uuid',
        'session-exercise-uuid',
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('removeSessionExercise()', () => {
    it('delega en el service', async () => {
      const expected = {
        data: null,
        message: 'Ejercicio eliminado exitosamente de la sesion',
      };
      mockPlansService.removeSessionExercise.mockResolvedValue(expected);

      const result = await controller.removeSessionExercise(
        USER as never,
        'plan-uuid',
        'session-uuid',
        'session-exercise-uuid',
      );

      expect(mockPlansService.removeSessionExercise).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
        'session-uuid',
        'session-exercise-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('publish()', () => {
    it('delega en el service', async () => {
      const expected = { id: 'plan-uuid', status: 'PUBLISHED' };
      mockPlansService.publish.mockResolvedValue(expected);

      const result = await controller.publish(USER as never, 'plan-uuid');

      expect(mockPlansService.publish).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('unpublish()', () => {
    it('delega en el service', async () => {
      const expected = { id: 'plan-uuid', status: 'DRAFT' };
      mockPlansService.unpublish.mockResolvedValue(expected);

      const result = await controller.unpublish(USER as never, 'plan-uuid');

      expect(mockPlansService.unpublish).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('archive()', () => {
    it('delega en el service', async () => {
      const expected = { id: 'plan-uuid', status: 'ARCHIVED' };
      mockPlansService.archive.mockResolvedValue(expected);

      const result = await controller.archive(USER as never, 'plan-uuid');

      expect(mockPlansService.archive).toHaveBeenCalledWith(
        USER.id,
        'plan-uuid',
      );
      expect(result).toBe(expected);
    });
  });
});
