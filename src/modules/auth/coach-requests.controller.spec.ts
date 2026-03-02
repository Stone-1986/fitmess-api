import { Test, TestingModule } from '@nestjs/testing';
import { CoachRequestsController } from './coach-requests.controller.js';
import { CoachRequestsService } from './coach-requests.service.js';
import { CoachRequestStatus } from '../../../generated/prisma/index.js';
import { UserRole } from '../../../generated/prisma/index.js';
import { SearchCoachRequestsDto } from './dto/search-coach-requests.dto.js';
import { RejectCoachRequestDto } from './dto/reject-coach-request.dto.js';
import { AuthUser } from './strategies/jwt.strategy.js';
import { IdentificationType } from './enums/identification-type.enum.js';

// ── Datos de prueba ────────────────────────────────────────────────────────────

const REQUEST_ID = 'coach-req-uuid-001';
const USER_ID = 'user-uuid-001';
const ADMIN_ID = 'admin-uuid-001';

const mockAdminUser: AuthUser = {
  id: ADMIN_ID,
  email: 'admin@test.com',
  role: UserRole.ADMIN,
};

const mockApprovedRequestResponse = {
  id: REQUEST_ID,
  status: CoachRequestStatus.APPROVED,
  createdAt: new Date('2026-03-01'),
  message: 'Solicitud aprobada.',
};

const mockRejectedRequestResponse = {
  id: REQUEST_ID,
  status: CoachRequestStatus.REJECTED,
  createdAt: new Date('2026-03-01'),
  message: 'Solicitud rechazada.',
};

const mockDetailResponse = {
  id: REQUEST_ID,
  status: CoachRequestStatus.PENDING,
  userId: USER_ID,
  coachName: 'Carlos Ramirez',
  coachEmail: 'coach@test.com',
  phoneCountryCode: '+57',
  phone: '3001234567',
  identificationType: IdentificationType.CC,
  identificationNumber: '1023456789',
  planDescription: 'Especialista en fuerza.',
  createdAt: new Date('2026-03-01'),
  updatedAt: new Date('2026-03-01'),
};

const mockSearchResult = {
  data: [
    {
      id: REQUEST_ID,
      userId: USER_ID,
      coachName: 'Carlos Ramirez',
      coachEmail: 'coach@test.com',
      identificationType: IdentificationType.CC,
      identificationNumber: '1023456789',
      status: CoachRequestStatus.PENDING,
      createdAt: new Date('2026-03-01'),
    },
  ],
  meta: {
    page: 1,
    limit: 10,
    totalItems: 1,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  },
};

// ── Mock de CoachRequestsService ──────────────────────────────────────────────

const coachRequestsServiceMock = {
  search: vi.fn(),
  findOne: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
};

// ── Suite principal ────────────────────────────────────────────────────────────

describe('CoachRequestsController', () => {
  let controller: CoachRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoachRequestsController],
      providers: [
        { provide: CoachRequestsService, useValue: coachRequestsServiceMock },
      ],
    }).compile();

    controller = module.get<CoachRequestsController>(CoachRequestsController);
    vi.clearAllMocks();
  });

  // ── search() ─────────────────────────────────────────────────────────────────

  describe('search() — POST /coach-requests/search', () => {
    it('delega al service con el DTO de busqueda', async () => {
      // Arrange
      coachRequestsServiceMock.search.mockResolvedValue(mockSearchResult);
      const dto: SearchCoachRequestsDto = {
        status: [CoachRequestStatus.PENDING],
      };

      // Act
      await controller.search(dto);

      // Assert
      expect(coachRequestsServiceMock.search).toHaveBeenCalledWith(dto);
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      coachRequestsServiceMock.search.mockResolvedValue(mockSearchResult);

      // Act
      const result = await controller.search({});

      // Assert
      expect(result).toBe(mockSearchResult);
    });

    it('delega con body vacio para obtener todas las solicitudes', async () => {
      // Arrange
      coachRequestsServiceMock.search.mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        },
      });

      // Act
      await controller.search({});

      // Assert
      expect(coachRequestsServiceMock.search).toHaveBeenCalledWith({});
    });
  });

  // ── findOne() ─────────────────────────────────────────────────────────────────

  describe('findOne() — GET /coach-requests/:id', () => {
    it('delega al service con el id correcto', async () => {
      // Arrange
      coachRequestsServiceMock.findOne.mockResolvedValue(mockDetailResponse);

      // Act
      await controller.findOne(REQUEST_ID);

      // Assert
      expect(coachRequestsServiceMock.findOne).toHaveBeenCalledWith(REQUEST_ID);
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      coachRequestsServiceMock.findOne.mockResolvedValue(mockDetailResponse);

      // Act
      const result = await controller.findOne(REQUEST_ID);

      // Assert
      expect(result).toBe(mockDetailResponse);
    });
  });

  // ── approve() ────────────────────────────────────────────────────────────────

  describe('approve() — POST /coach-requests/:id/approve', () => {
    it('delega al service con el id y el adminId del usuario autenticado', async () => {
      // Arrange
      coachRequestsServiceMock.approve.mockResolvedValue(
        mockApprovedRequestResponse,
      );

      // Act
      await controller.approve(REQUEST_ID, mockAdminUser);

      // Assert
      expect(coachRequestsServiceMock.approve).toHaveBeenCalledWith(
        REQUEST_ID,
        ADMIN_ID,
      );
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      coachRequestsServiceMock.approve.mockResolvedValue(
        mockApprovedRequestResponse,
      );

      // Act
      const result = await controller.approve(REQUEST_ID, mockAdminUser);

      // Assert
      expect(result).toBe(mockApprovedRequestResponse);
    });
  });

  // ── reject() ─────────────────────────────────────────────────────────────────

  describe('reject() — POST /coach-requests/:id/reject', () => {
    const rejectDto: RejectCoachRequestDto = {
      rejectionReason: 'No cumple con los requisitos minimos de experiencia.',
    };

    it('delega al service con el id, el DTO de rechazo y el adminId del usuario autenticado', async () => {
      // Arrange
      coachRequestsServiceMock.reject.mockResolvedValue(
        mockRejectedRequestResponse,
      );

      // Act
      await controller.reject(REQUEST_ID, rejectDto, mockAdminUser);

      // Assert
      expect(coachRequestsServiceMock.reject).toHaveBeenCalledWith(
        REQUEST_ID,
        rejectDto,
        ADMIN_ID,
      );
    });

    it('retorna el resultado del service sin modificarlo', async () => {
      // Arrange
      coachRequestsServiceMock.reject.mockResolvedValue(
        mockRejectedRequestResponse,
      );

      // Act
      const result = await controller.reject(
        REQUEST_ID,
        rejectDto,
        mockAdminUser,
      );

      // Assert
      expect(result).toBe(mockRejectedRequestResponse);
    });
  });
});
