/**
 * Tests unitarios de SubscriptionRequestedListener.
 *
 * Verifica:
 * - Que resuelve coach/athlete/plan via PrismaService y llama a EmailService
 *   con los parametros correctos
 * - Que NO envia el correo si falta algun dato (coach/athlete/plan)
 * - Que captura errores y NO los relanza (no interrumpe el pipeline HTTP)
 * - Que el log SOLO registra el subscriptionId — nunca el nombre del atleta
 *   ni el correo del entrenador (Ley 1273/2009)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { SubscriptionRequestedListener } from './subscription-requested.listener.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EmailService } from '../email.service.js';
import type { SubscriptionRequestedEvent } from './subscription-requested.listener.js';

const SUBSCRIPTION_ID = 'subscription-uuid';
const ATHLETE_ID = 'athlete-uuid';
const PLAN_ID = 'plan-uuid';
const COACH_ID = 'coach-uuid';
const ATHLETE_NAME = 'Maria Fernanda Lopez';
const COACH_EMAIL = 'coach@fitmess.co';
const PLAN_NAME = 'Fuerza e hipertrofia';

const mockEvent: SubscriptionRequestedEvent = {
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
  sendSubscriptionRequested: vi.fn(),
};

const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('SubscriptionRequestedListener', () => {
  let listener: SubscriptionRequestedListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRequestedListener,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: emailServiceMock },
        {
          provide: getLoggerToken(SubscriptionRequestedListener.name),
          useValue: loggerMock,
        },
      ],
    }).compile();

    listener = module.get<SubscriptionRequestedListener>(
      SubscriptionRequestedListener,
    );
    vi.clearAllMocks();
  });

  describe('handleSubscriptionRequested()', () => {
    function mockDatosCompletos(): void {
      prismaMock.user.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) => {
          if (where.id === COACH_ID) {
            return Promise.resolve({ email: COACH_EMAIL });
          }
          if (where.id === ATHLETE_ID) {
            return Promise.resolve({ name: ATHLETE_NAME });
          }
          return Promise.resolve(null);
        },
      );
      prismaMock.plan.findUnique.mockResolvedValue({ name: PLAN_NAME });
    }

    it('resuelve coach/athlete/plan y llama a EmailService.sendSubscriptionRequested', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRequested.mockResolvedValue(undefined);

      await listener.handleSubscriptionRequested(mockEvent);

      expect(emailServiceMock.sendSubscriptionRequested).toHaveBeenCalledWith(
        COACH_EMAIL,
        ATHLETE_NAME,
        PLAN_NAME,
      );
    });

    it('NO envia el correo si el coach no existe', async () => {
      prismaMock.user.findUnique.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          where.id === ATHLETE_ID
            ? Promise.resolve({ name: ATHLETE_NAME })
            : Promise.resolve(null),
      );
      prismaMock.plan.findUnique.mockResolvedValue({ name: PLAN_NAME });

      await listener.handleSubscriptionRequested(mockEvent);

      expect(emailServiceMock.sendSubscriptionRequested).not.toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('NO envia el correo si el plan no existe', async () => {
      mockDatosCompletos();
      prismaMock.plan.findUnique.mockResolvedValue(null);

      await listener.handleSubscriptionRequested(mockEvent);

      expect(emailServiceMock.sendSubscriptionRequested).not.toHaveBeenCalled();
    });

    it('NO relanza el error cuando EmailService lanza una excepcion', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRequested.mockRejectedValue(
        new Error('Email service unavailable'),
      );

      await expect(
        listener.handleSubscriptionRequested(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('tolera un rechazo que no es una instancia de Error', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRequested.mockRejectedValue(
        'fallo sin objeto Error',
      );

      await expect(
        listener.handleSubscriptionRequested(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('el log de error SOLO registra el subscriptionId — nunca el nombre del atleta ni el correo del entrenador (Ley 1273/2009)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRequested.mockRejectedValue(
        new Error('SMTP timeout'),
      );

      await listener.handleSubscriptionRequested(mockEvent);

      expect(loggerMock.error).toHaveBeenCalled();
      const allErrorArgs = JSON.stringify(loggerMock.error.mock.calls);
      expect(allErrorArgs).toContain(SUBSCRIPTION_ID);
      expect(allErrorArgs).not.toContain(ATHLETE_NAME);
      expect(allErrorArgs).not.toContain(COACH_EMAIL);
    });

    it('el log de datos incompletos SOLO registra el subscriptionId', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.plan.findUnique.mockResolvedValue(null);

      await listener.handleSubscriptionRequested(mockEvent);

      const allWarnArgs = JSON.stringify(loggerMock.warn.mock.calls);
      expect(allWarnArgs).toContain(SUBSCRIPTION_ID);
    });

    it('retorna undefined cuando el envio es exitoso (void return)', async () => {
      mockDatosCompletos();
      emailServiceMock.sendSubscriptionRequested.mockResolvedValue(undefined);

      const result = await listener.handleSubscriptionRequested(mockEvent);

      expect(result).toBeUndefined();
    });
  });
});
