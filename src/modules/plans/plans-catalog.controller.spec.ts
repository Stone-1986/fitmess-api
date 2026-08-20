import { Test, TestingModule } from '@nestjs/testing';
import { PlansCatalogController } from './plans-catalog.controller.js';
import { PlansService } from './plans.service.js';

/**
 * PlansCatalogController es THIN (rulesCodigo §Controllers): solo delega en
 * PlansService y retorna el resultado sin modificarlo (HU-011).
 */
const mockPlansService = {
  findPublished: vi.fn(),
  findPublishedOne: vi.fn(),
};

describe('PlansCatalogController', () => {
  let controller: PlansCatalogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansCatalogController],
      providers: [{ provide: PlansService, useValue: mockPlansService }],
    }).compile();

    controller = module.get<PlansCatalogController>(PlansCatalogController);
  });

  afterEach(() => vi.clearAllMocks());

  describe('findAll()', () => {
    it('delega en el service con la paginacion recibida', async () => {
      const expected = { data: [], meta: {} };
      mockPlansService.findPublished.mockResolvedValue(expected);

      const result = await controller.findAll(2, 10);

      expect(mockPlansService.findPublished).toHaveBeenCalledWith(2, 10);
      expect(result).toBe(expected);
    });
  });

  describe('findOne()', () => {
    it('delega en el service con el id del plan', async () => {
      const expected = { id: 'plan-uuid', coach: {} };
      mockPlansService.findPublishedOne.mockResolvedValue(expected);

      const result = await controller.findOne('plan-uuid');

      expect(mockPlansService.findPublishedOne).toHaveBeenCalledWith(
        'plan-uuid',
      );
      expect(result).toBe(expected);
    });
  });
});
