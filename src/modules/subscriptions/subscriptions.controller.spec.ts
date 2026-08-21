import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * SubscriptionsController es THIN (rulesCodigo §Controllers): solo delega al
 * service y retorna el resultado sin modificarlo. Estos tests verifican
 * exactamente eso para los 6 endpoints de /subscriptions — nada de logica de
 * negocio se prueba aqui (ya cubierta en subscriptions.service.spec.ts).
 */
const mockSubscriptionsService = {
  create: vi.fn(),
  findMine: vi.fn(),
  findPending: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  acceptConsent: vi.fn(),
};

const ATHLETE = {
  id: 'athlete-uuid',
  email: 'athlete@test.com',
  role: 'ATHLETE',
};
const COACH = { id: 'coach-uuid', email: 'coach@test.com', role: 'COACH' };

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  afterEach(() => vi.clearAllMocks());

  describe('create()', () => {
    it('delega en el service con el id del atleta y el dto', async () => {
      const dto = { planId: 'plan-uuid' };
      const expected = { id: 'subscription-uuid', status: 'PENDING' };
      mockSubscriptionsService.create.mockResolvedValue(expected);

      const result = await controller.create(ATHLETE as never, dto as never);

      expect(mockSubscriptionsService.create).toHaveBeenCalledWith(
        ATHLETE.id,
        dto,
      );
      expect(result).toBe(expected);
    });
  });

  describe('findMine()', () => {
    it('delega en el service con el id del atleta y la paginacion', async () => {
      const expected = { data: [], meta: {} };
      mockSubscriptionsService.findMine.mockResolvedValue(expected);

      const result = await controller.findMine(ATHLETE as never, 2, 10);

      expect(mockSubscriptionsService.findMine).toHaveBeenCalledWith(
        ATHLETE.id,
        2,
        10,
      );
      expect(result).toBe(expected);
    });
  });

  describe('findPending()', () => {
    it('delega en el service con el id del coach y la paginacion', async () => {
      const expected = { data: [], meta: {} };
      mockSubscriptionsService.findPending.mockResolvedValue(expected);

      const result = await controller.findPending(COACH as never, 1, 20);

      expect(mockSubscriptionsService.findPending).toHaveBeenCalledWith(
        COACH.id,
        1,
        20,
      );
      expect(result).toBe(expected);
    });
  });

  describe('approve()', () => {
    it('delega en el service con el id del coach y el id de la suscripcion', async () => {
      const expected = { id: 'subscription-uuid', status: 'APPROVED' };
      mockSubscriptionsService.approve.mockResolvedValue(expected);

      const result = await controller.approve(
        COACH as never,
        'subscription-uuid',
      );

      expect(mockSubscriptionsService.approve).toHaveBeenCalledWith(
        COACH.id,
        'subscription-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('reject()', () => {
    it('delega en el service con el id del coach y el id de la suscripcion', async () => {
      const expected = { id: 'subscription-uuid', status: 'REJECTED' };
      mockSubscriptionsService.reject.mockResolvedValue(expected);

      const result = await controller.reject(
        COACH as never,
        'subscription-uuid',
      );

      expect(mockSubscriptionsService.reject).toHaveBeenCalledWith(
        COACH.id,
        'subscription-uuid',
      );
      expect(result).toBe(expected);
    });
  });

  describe('acceptConsent()', () => {
    it('delega en el service con id de atleta, id de suscripcion, dto, ip y user-agent del request', async () => {
      const dto = { documentVersion: '1.0.0' };
      const expected = { id: 'subscription-uuid', status: 'ACTIVE' };
      mockSubscriptionsService.acceptConsent.mockResolvedValue(expected);
      const req = {
        ip: '203.0.113.5',
        headers: { 'user-agent': 'Mozilla/5.0' },
      } as unknown as Request;

      const result = await controller.acceptConsent(
        ATHLETE as never,
        'subscription-uuid',
        dto as never,
        req,
      );

      expect(mockSubscriptionsService.acceptConsent).toHaveBeenCalledWith(
        ATHLETE.id,
        'subscription-uuid',
        dto,
        '203.0.113.5',
        'Mozilla/5.0',
      );
      expect(result).toBe(expected);
    });

    it('usa "0.0.0.0" como ip y "unknown" como user-agent cuando el request no los trae', async () => {
      const dto = { documentVersion: '1.0.0' };
      mockSubscriptionsService.acceptConsent.mockResolvedValue({});
      const req = { ip: undefined, headers: {} } as unknown as Request;

      await controller.acceptConsent(
        ATHLETE as never,
        'subscription-uuid',
        dto as never,
        req,
      );

      expect(mockSubscriptionsService.acceptConsent).toHaveBeenCalledWith(
        ATHLETE.id,
        'subscription-uuid',
        dto,
        '0.0.0.0',
        'unknown',
      );
    });
  });
});
