import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlanPublishedGuard } from './plan-published.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlanStatus } from '../../../../generated/prisma/index.js';
import { BusinessException } from '../exceptions/business.exception.js';
import { BusinessError } from '../exceptions/business-error.enum.js';

const mockPrisma = {
  plan: {
    findUnique: vi.fn(),
  },
};

const PLAN_ID = 'plan-uuid';

const createContext = (params: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ params }),
    }),
  }) as unknown as ExecutionContext;

describe('PlanPublishedGuard', () => {
  let guard: PlanPublishedGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanPublishedGuard,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<PlanPublishedGuard>(PlanPublishedGuard);
  });

  afterEach(() => vi.clearAllMocks());

  it('permite el acceso cuando el plan esta en Borrador (RN-31)', async () => {
    mockPrisma.plan.findUnique.mockResolvedValue({ status: PlanStatus.DRAFT });
    const context = createContext({ id: PLAN_ID });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      select: { status: true },
    });
  });

  it('permite el acceso cuando el plan no existe — la verificacion real de existencia/ownership la hace findOwnedOrFail en el service', async () => {
    mockPrisma.plan.findUnique.mockResolvedValue(null);
    const context = createContext({ id: 'inexistente' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('lanza PLAN_IMMUTABLE (409) cuando el plan esta Publicado (RN-31)', async () => {
    mockPrisma.plan.findUnique.mockResolvedValue({
      status: PlanStatus.PUBLISHED,
    });
    const context = createContext({ id: PLAN_ID });

    await expect(guard.canActivate(context)).rejects.toThrow(BusinessException);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      errorEntry: BusinessError.PLAN_IMMUTABLE,
    });
  });

  it('lanza PLAN_IMMUTABLE (409) cuando el plan esta Finalizado', async () => {
    mockPrisma.plan.findUnique.mockResolvedValue({
      status: PlanStatus.FINALIZED,
    });
    const context = createContext({ id: PLAN_ID });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      errorEntry: BusinessError.PLAN_IMMUTABLE,
    });
  });

  it('lanza PLAN_IMMUTABLE (409) cuando el plan esta Archivado', async () => {
    mockPrisma.plan.findUnique.mockResolvedValue({
      status: PlanStatus.ARCHIVED,
    });
    const context = createContext({ id: PLAN_ID });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      errorEntry: BusinessError.PLAN_IMMUTABLE,
    });
  });
});
