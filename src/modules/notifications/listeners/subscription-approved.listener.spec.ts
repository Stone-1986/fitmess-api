/**
 * Tests unitarios de SubscriptionApprovedListener.
 *
 * Verifica:
 * - Que resuelve athlete/plan via PrismaService y llama a EmailService con
 *   los parametros correctos
 * - Que NO envia el correo si falta algun dato (athlete/plan)
 * - Que captura errores y NO los relanza (no interrumpe el pipeline HTTP)
 * - Que el log SOLO registra el subscriptionId — nunca el correo del atleta
 *   (Ley 1273/2009)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { SubscriptionApprovedListener } from './subscription-approved.listener.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../email.service.js';
import type { SubscriptionApprovedEvent } from './subscription-approved.listener.js';

const SUBSCRIPTION_ID = 'subscription-uuid';
const ATHLETE_ID = 'athlete-uuid';
const PLAN_ID = 'plan-uuid';
const COACH_ID = 'coach-uuid';
const ATHLETE_EMAIL = 'atleta@fitmess.co';
const PLAN_NAME = 'Fuerza e hipertrofia';

const mockEvent: SubscriptionApprovedEvent = {
  subscriptionId: SUBSCRIPTION_ID,
  athleteId: ATHLETE_ID,
  planId: PLAN_ID,
  coachId: COACH_ID,
};

const prismaMock = {
  user: { findUnique: vi.fn() },
  plan: { findUnique: vi.fn() },
};

const emailServiceMock = {
  sendSubscriptionApproved: vi.fn(),
};

const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('SubscriptionApprovedListener', () => {
  let listener: SubscriptionApprovedListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionApprovedListener,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: emailServiceMock },
        {
          provide: getLoggerToken(SubscriptionApprovedListener.name),
          useValue: loggerMock,
        },
      ],
    }).compile();

    listener = module.get<SubscriptionApprovedListener>(
      SubscriptionApprovedListener,
    );
    vi.clearAllMocks();
  });

  describe('handleSubscriptionApproved()', () => {
    function mockDatosCompletos(): void {
      prismaMock.user.findUnique.mockResolvedValue({ email: ATHLETE_EMAIL });
      prismaMock.plan.findUnique.mockResolvedValue({ name: PLAN_NAME });
    }

    it('resuelve athlete/plan y llama a EmailService.sendSubscriptionApproved (CA-013-1)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionApproved.mockResolvedValue(undefined);

      await listener.handleSubscriptionApproved(mockEvent);

      expect(emailServiceMock.sendSubscriptionApproved).toHaveBeenCalledWith(
        ATHLETE_EMAIL,
        PLAN_NAME,
      );
    });

    it('NO envia el correo si el atleta no existe', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.plan.findUnique.mockResolvedValue({ name: PLAN_NAME });

      await listener.handleSubscriptionApproved(mockEvent);

      expect(emailServiceMock.sendSubscriptionApproved).not.toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('NO envia el correo si el plan no existe', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ email: ATHLETE_EMAIL });
      prismaMock.plan.findUnique.mockResolvedValue(null);

      await listener.handleSubscriptionApproved(mockEvent);

      expect(emailServiceMock.sendSubscriptionApproved).not.toHaveBeenCalled();
    });

    it('NO relanza el error cuando EmailService lanza una excepcion', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionApproved.mockRejectedValue(
        new Error('Email service unavailable'),
      );

      await expect(
        listener.handleSubscriptionApproved(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('tolera un rechazo que no es una instancia de Error', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionApproved.mockRejectedValue(
        'fallo sin objeto Error',
      );

      await expect(
        listener.handleSubscriptionApproved(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('el log de error SOLO registra el subscriptionId — nunca el correo del atleta (Ley 1273/2009)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionApproved.mockRejectedValue(
        new Error('SMTP timeout'),
      );

      await listener.handleSubscriptionApproved(mockEvent);

      expect(loggerMock.error).toHaveBeenCalled();
      const allErrorArgs = JSON.stringify(loggerMock.error.mock.calls);
      expect(allErrorArgs).toContain(SUBSCRIPTION_ID);
      expect(allErrorArgs).not.toContain(ATHLETE_EMAIL);
    });

    it('retorna undefined cuando el envio es exitoso (void return)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionApproved.mockResolvedValue(undefined);

      const result = await listener.handleSubscriptionApproved(mockEvent);

      expect(result).toBeUndefined();
    });
  });
});
