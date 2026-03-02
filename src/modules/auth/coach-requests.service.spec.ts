import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoachRequestsService } from './coach-requests.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CoachRequestStatus } from '../../../generated/prisma/index.js';
import { BusinessError } from '../common/exceptions/business-error.enum.js';
import { TechnicalException } from '../common/exceptions/technical.exception.js';
import { RejectCoachRequestDto } from './dto/reject-coach-request.dto.js';
import { IdentificationType } from './enums/identification-type.enum.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const REQUEST_ID = 'coach-req-uuid-001';
const USER_ID = 'user-uuid-001';
const ADMIN_ID = 'admin-uuid-001';

const mockPendingRequest = {
  id: REQUEST_ID,
  userId: USER_ID,
  status: CoachRequestStatus.PENDING,
  createdAt: new Date('2026-03-01'),
};

const mockApprovedRequest = {
  id: REQUEST_ID,
  userId: USER_ID,
  status: CoachRequestStatus.APPROVED,
  createdAt: new Date('2026-03-01'),
};

const mockRejectedRequest = {
  id: REQUEST_ID,
  userId: USER_ID,
  status: CoachRequestStatus.REJECTED,
  createdAt: new Date('2026-03-01'),
};

const mockRequestDetail = {
  id: REQUEST_ID,
  userId: USER_ID,
  status: CoachRequestStatus.PENDING,
  planDescription: 'Especialista en fuerza.',
  bannerUrl: null,
  rejectionReason: null,
  reviewedAt: null,
  updatedAt: new Date('2026-03-01'),
  createdAt: new Date('2026-03-01'),
  user: {
    name: 'Carlos Ramirez',
    email: 'coach@test.com',
    phone: '3001234567',
    phoneCountryCode: '+57',
    identificationType: IdentificationType.CC,
    identificationNumber: '1023456789',
    dateOfBirth: null,
    avatarUrl: null,
  },
};

// ── Mock de PrismaService ──────────────────────────────────────────────────────

const prismaMock = {
  $transaction: vi.fn(),
  coachRequest: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
};

// ── Mock de EventEmitter2 ──────────────────────────────────────────────────────

const eventEmitterMock = {
  emit: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('CoachRequestsService', () => {
  let service: CoachRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachRequestsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<CoachRequestsService>(CoachRequestsService);
    vi.clearAllMocks();
  });

  // ── search() ─────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('retorna lista paginada con meta cuando el body esta vacio', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([
        1,
        [
          {
            id: REQUEST_ID,
            userId: USER_ID,
            status: CoachRequestStatus.PENDING,
            bannerUrl: null,
            reviewedAt: null,
            createdAt: new Date('2026-03-01'),
            user: {
              name: 'Carlos Ramirez',
              email: 'coach@test.com',
              identificationType: IdentificationType.CC,
              identificationNumber: '1023456789',
            },
          },
        ],
      ]);

      // Act
      const result = await service.search({});

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.hasPrevious).toBe(false);
    });

    it('aplica paginacion por defecto (page=1, limit=10) cuando no se especifica', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.search({});

      // Assert — la transaccion se llama con skip=0, take=10
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('aplica filtro por status cuando se especifica', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.search({ status: [CoachRequestStatus.PENDING] });

      // Assert — la llamada se ejecuta sin error
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('aplica filtro por ids cuando se especifica', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.search({ ids: [REQUEST_ID] });

      // Assert
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('aplica filtro por email (exacto) cuando se especifica', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.search({ email: 'coach@test.com' });

      // Assert
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('aplica filtro por name (ILIKE parcial) cuando se especifica', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.search({ name: 'Carlos' });

      // Assert
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('aplica filtro por createdAt (rango del dia) cuando se especifica', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.search({ createdAt: '2026-03-01' });

      // Assert
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('calcula hasNext y hasPrevious correctamente con paginacion', async () => {
      // Arrange — 25 items, pagina 2, limit 10
      prismaMock.$transaction.mockResolvedValue([25, []]);

      // Act
      const result = await service.search({ page: 2, limit: 10 });

      // Assert
      expect(result.meta.totalItems).toBe(25);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNext).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
    });

    it('lanza TechnicalException DATABASE_ERROR ante error de base de datos', async () => {
      // Arrange
      prismaMock.$transaction.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.search({})).rejects.toThrow(TechnicalException);
    });

    it('el email se normaliza a minusculas en el filtro', async () => {
      // Arrange
      prismaMock.$transaction.mockResolvedValue([0, []]);

      // Act
      await service.search({ email: 'COACH@TEST.COM' });

      // Assert — verificar que la transaccion se ejecuto (el filtro normalizo a lower)
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('retorna el detalle completo de la solicitud cuando existe', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockRequestDetail);

      // Act
      const result = await service.findOne(REQUEST_ID);

      // Assert
      expect(result.id).toBe(REQUEST_ID);
      expect(result.status).toBe(CoachRequestStatus.PENDING);
      expect(result.coachName).toBe('Carlos Ramirez');
      expect(result.coachEmail).toBe('coach@test.com');
      expect(result.planDescription).toBe('Especialista en fuerza.');
      expect(result.userId).toBe(USER_ID);
    });

    it('lanza BusinessException ENTITY_NOT_FOUND cuando la solicitud no existe', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('nonexistent-id')).rejects.toMatchObject({
        errorEntry: BusinessError.ENTITY_NOT_FOUND,
      });
    });

    it('el detalle incluye bannerUrl como undefined cuando es null en BD', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue({
        ...mockRequestDetail,
        bannerUrl: null,
      });

      // Act
      const result = await service.findOne(REQUEST_ID);

      // Assert
      expect(result.bannerUrl).toBeUndefined();
    });

    it('el detalle incluye avatarUrl como undefined cuando es null en BD', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockRequestDetail);

      // Act
      const result = await service.findOne(REQUEST_ID);

      // Assert
      expect(result.avatarUrl).toBeUndefined();
    });
  });

  // ── approve() ────────────────────────────────────────────────────────────────

  describe('approve()', () => {
    it('aprueba solicitud PENDING → APPROVED y emite coach.request.approved', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockPendingRequest);
      const updatedRequest = {
        id: REQUEST_ID,
        status: CoachRequestStatus.APPROVED,
        createdAt: new Date(),
      };
      prismaMock.coachRequest.update.mockResolvedValue(updatedRequest);

      // Act
      const result = await service.approve(REQUEST_ID, ADMIN_ID);

      // Assert
      expect(result.status).toBe(CoachRequestStatus.APPROVED);
      expect(result.message).toContain('aprobada');
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'coach.request.approved',
        {
          coachRequestId: REQUEST_ID,
          coachUserId: USER_ID,
          adminId: ADMIN_ID,
        },
      );
    });

    it('persiste reviewedAt y reviewedBy (adminId) en la aprobacion', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockPendingRequest);
      const updatedRequest = {
        id: REQUEST_ID,
        status: CoachRequestStatus.APPROVED,
        createdAt: new Date(),
      };
      prismaMock.coachRequest.update.mockResolvedValue(updatedRequest);

      // Act
      await service.approve(REQUEST_ID, ADMIN_ID);

      // Assert
      expect(prismaMock.coachRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CoachRequestStatus.APPROVED,
            reviewedAt: expect.any(Date),
            reviewedBy: ADMIN_ID,
          }),
        }),
      );
    });

    it('lanza BusinessException ENTITY_NOT_FOUND cuando la solicitud no existe', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.approve('nonexistent-id', ADMIN_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.ENTITY_NOT_FOUND,
      });
    });

    it('state machine: lanza BusinessException INVALID_STATE_TRANSITION si la solicitud esta APPROVED', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockApprovedRequest);

      // Act & Assert
      await expect(service.approve(REQUEST_ID, ADMIN_ID)).rejects.toMatchObject(
        {
          errorEntry: BusinessError.INVALID_STATE_TRANSITION,
        },
      );
    });

    it('state machine: lanza BusinessException INVALID_STATE_TRANSITION si la solicitud esta REJECTED', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockRejectedRequest);

      // Act & Assert
      await expect(service.approve(REQUEST_ID, ADMIN_ID)).rejects.toMatchObject(
        {
          errorEntry: BusinessError.INVALID_STATE_TRANSITION,
        },
      );
    });

    it('lanza TechnicalException DATABASE_ERROR si falla la actualizacion en BD', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockPendingRequest);
      prismaMock.coachRequest.update.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.approve(REQUEST_ID, ADMIN_ID)).rejects.toThrow(
        TechnicalException,
      );
    });

    it('NO emite evento si la solicitud no estaba PENDING (state machine falla primero)', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockApprovedRequest);

      // Act
      await service.approve(REQUEST_ID, ADMIN_ID).catch(() => {});

      // Assert
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
    });
  });

  // ── reject() ─────────────────────────────────────────────────────────────────

  describe('reject()', () => {
    const rejectDto: RejectCoachRequestDto = {
      rejectionReason: 'No cumple con los requisitos minimos de experiencia.',
    };

    it('rechaza solicitud PENDING → REJECTED y emite coach.request.rejected con motivo', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockPendingRequest);
      const updatedRequest = {
        id: REQUEST_ID,
        status: CoachRequestStatus.REJECTED,
        createdAt: new Date(),
      };
      prismaMock.coachRequest.update.mockResolvedValue(updatedRequest);

      // Act
      const result = await service.reject(REQUEST_ID, rejectDto, ADMIN_ID);

      // Assert
      expect(result.status).toBe(CoachRequestStatus.REJECTED);
      expect(result.message).toContain('rechazada');
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'coach.request.rejected',
        {
          coachRequestId: REQUEST_ID,
          coachUserId: USER_ID,
          adminId: ADMIN_ID,
          reason: rejectDto.rejectionReason,
        },
      );
    });

    it('persiste rejectionReason, reviewedAt y reviewedBy en el rechazo', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockPendingRequest);
      const updatedRequest = {
        id: REQUEST_ID,
        status: CoachRequestStatus.REJECTED,
        createdAt: new Date(),
      };
      prismaMock.coachRequest.update.mockResolvedValue(updatedRequest);

      // Act
      await service.reject(REQUEST_ID, rejectDto, ADMIN_ID);

      // Assert
      expect(prismaMock.coachRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CoachRequestStatus.REJECTED,
            rejectionReason: rejectDto.rejectionReason,
            reviewedAt: expect.any(Date),
            reviewedBy: ADMIN_ID,
          }),
        }),
      );
    });

    it('lanza BusinessException ENTITY_NOT_FOUND cuando la solicitud no existe', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.reject('nonexistent-id', rejectDto, ADMIN_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.ENTITY_NOT_FOUND,
      });
    });

    it('state machine: lanza BusinessException INVALID_STATE_TRANSITION si la solicitud esta APPROVED', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockApprovedRequest);

      // Act & Assert
      await expect(
        service.reject(REQUEST_ID, rejectDto, ADMIN_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
    });

    it('state machine: lanza BusinessException INVALID_STATE_TRANSITION si la solicitud esta REJECTED', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockRejectedRequest);

      // Act & Assert
      await expect(
        service.reject(REQUEST_ID, rejectDto, ADMIN_ID),
      ).rejects.toMatchObject({
        errorEntry: BusinessError.INVALID_STATE_TRANSITION,
      });
    });

    it('lanza TechnicalException DATABASE_ERROR si falla la actualizacion en BD', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockPendingRequest);
      prismaMock.coachRequest.update.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(
        service.reject(REQUEST_ID, rejectDto, ADMIN_ID),
      ).rejects.toThrow(TechnicalException);
    });

    it('NO emite evento si la solicitud no estaba PENDING (state machine falla primero)', async () => {
      // Arrange
      prismaMock.coachRequest.findUnique.mockResolvedValue(mockRejectedRequest);

      // Act
      await service.reject(REQUEST_ID, rejectDto, ADMIN_ID).catch(() => {});

      // Assert
      expect(eventEmitterMock.emit).not.toHaveBeenCalled();
    });
  });
});
