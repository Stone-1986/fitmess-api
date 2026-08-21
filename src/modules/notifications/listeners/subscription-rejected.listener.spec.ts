/**
 * Tests unitarios de SubscriptionRejectedListener.
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
import { SubscriptionRejectedListener } from './subscription-rejected.listener.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../email.service.js';
import type { SubscriptionRejectedEvent } from './subscription-rejected.listener.js';

const SUBSCRIPTION_ID = 'subscription-uuid';
const ATHLETE_ID = 'athlete-uuid';
const PLAN_ID = 'plan-uuid';
const COACH_ID = 'coach-uuid';
const ATHLETE_EMAIL = 'atleta@fitmess.co';
const PLAN_NAME = 'Fuerza e hipertrofia';

const mockEvent: SubscriptionRejectedEvent = {
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
  sendSubscriptionRejected: vi.fn(),
};

const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('SubscriptionRejectedListener', () => {
  let listener: SubscriptionRejectedListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRejectedListener,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: emailServiceMock },
        {
          provide: getLoggerToken(SubscriptionRejectedListener.name),
          useValue: loggerMock,
        },
      ],
    }).compile();

    listener = module.get<SubscriptionRejectedListener>(
      SubscriptionRejectedListener,
    );
    vi.clearAllMocks();
  });

  describe('handleSubscriptionRejected()', () => {
    function mockDatosCompletos(): void {
      prismaMock.user.findUnique.mockResolvedValue({ email: ATHLETE_EMAIL });
      prismaMock.plan.findUnique.mockResolvedValue({ name: PLAN_NAME });
    }

    it('resuelve athlete/plan y llama a EmailService.sendSubscriptionRejected (CA-013-2)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRejected.mockResolvedValue(undefined);

      await listener.handleSubscriptionRejected(mockEvent);

      expect(emailServiceMock.sendSubscriptionRejected).toHaveBeenCalledWith(
        ATHLETE_EMAIL,
        PLAN_NAME,
      );
    });

    it('NO envia el correo si el atleta no existe', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.plan.findUnique.mockResolvedValue({ name: PLAN_NAME });

      await listener.handleSubscriptionRejected(mockEvent);

      expect(emailServiceMock.sendSubscriptionRejected).not.toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('NO envia el correo si el plan no existe', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ email: ATHLETE_EMAIL });
      prismaMock.plan.findUnique.mockResolvedValue(null);

      await listener.handleSubscriptionRejected(mockEvent);

      expect(emailServiceMock.sendSubscriptionRejected).not.toHaveBeenCalled();
    });

    it('NO relanza el error cuando EmailService lanza una excepcion', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRejected.mockRejectedValue(
        new Error('Email service unavailable'),
      );

      await expect(
        listener.handleSubscriptionRejected(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('tolera un rechazo que no es una instancia de Error', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRejected.mockRejectedValue(
        'fallo sin objeto Error',
      );

      await expect(
        listener.handleSubscriptionRejected(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('el log de error SOLO registra el subscriptionId — nunca el correo del atleta (Ley 1273/2009)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRejected.mockRejectedValue(
        new Error('SMTP timeout'),
      );

      await listener.handleSubscriptionRejected(mockEvent);

      expect(loggerMock.error).toHaveBeenCalled();
      const allErrorArgs = JSON.stringify(loggerMock.error.mock.calls);
      expect(allErrorArgs).toContain(SUBSCRIPTION_ID);
      expect(allErrorArgs).not.toContain(ATHLETE_EMAIL);
    });

    it('retorna undefined cuando el envio es exitoso (void return)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRejected.mockResolvedValue(undefined);

      const result = await listener.handleSubscriptionRejected(mockEvent);

      expect(result).toBeUndefined();
    });
  });
});
