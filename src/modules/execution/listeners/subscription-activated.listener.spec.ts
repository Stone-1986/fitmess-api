/**
 * Tests unitarios de SubscriptionActivatedListener (EPICA-05, HU-023, D-3).
 *
 * Verifica:
 * - Que llama a InstancesService.getOrCreateInstance() con los IDs del evento
 * - Que captura errores y NO los relanza (los listeners no propagan
 *   excepciones al pipeline HTTP, rulesCodigo §Manejo de excepciones)
 * - Que el log de error SOLO registra IDs (subscriptionId, errorMessage) —
 *   nunca datos personales (Ley 1273/2009)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { SubscriptionActivatedListener } from './subscription-activated.listener.js';
import { InstancesService } from '../instances.service.js';
import type { SubscriptionActivatedEvent } from './subscription-activated.listener.js';

const SUBSCRIPTION_ID = 'subscription-uuid';
const ATHLETE_ID = 'athlete-uuid';
const PLAN_ID = 'plan-uuid';

const mockEvent: SubscriptionActivatedEvent = {
  subscriptionId: SUBSCRIPTION_ID,
  athleteId: ATHLETE_ID,
  planId: PLAN_ID,
};

const instancesServiceMock = {
  getOrCreateInstance: vi.fn(),
};

const loggerMock = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('SubscriptionActivatedListener', () => {
  let listener: SubscriptionActivatedListener;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionActivatedListener,
        { provide: InstancesService, useValue: instancesServiceMock },
        {
          provide: getLoggerToken(SubscriptionActivatedListener.name),
          useValue: loggerMock,
        },
      ],
    }).compile();

    listener = module.get<SubscriptionActivatedListener>(
      SubscriptionActivatedListener,
    );
    vi.clearAllMocks();
  });

  describe('handleSubscriptionActivated()', () => {
    it('llama a InstancesService.getOrCreateInstance() con los IDs del evento (D-3, camino rapido)', async () => {
      instancesServiceMock.getOrCreateInstance.mockResolvedValue({
        id: 'instance-uuid',
      });

      await listener.handleSubscriptionActivated(mockEvent);

      expect(instancesServiceMock.getOrCreateInstance).toHaveBeenCalledWith(
        ATHLETE_ID,
        PLAN_ID,
        SUBSCRIPTION_ID,
      );
    });

    it('NO relanza el error cuando InstancesService falla — se autorrepara en el proximo GET (D-3)', async () => {
      instancesServiceMock.getOrCreateInstance.mockRejectedValue(
        new Error('DB caida'),
      );

      await expect(
        listener.handleSubscriptionActivated(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('tolera un rechazo que no es una instancia de Error', async () => {
      instancesServiceMock.getOrCreateInstance.mockRejectedValue(
        'fallo sin objeto Error',
      );

      await expect(
        listener.handleSubscriptionActivated(mockEvent),
      ).resolves.toBeUndefined();
    });

    it('el log de error SOLO registra IDs — nunca datos personales (Ley 1273/2009)', async () => {
      instancesServiceMock.getOrCreateInstance.mockRejectedValue(
        new Error('Connection timeout'),
      );

      await listener.handleSubscriptionActivated(mockEvent);

      expect(loggerMock.error).toHaveBeenCalledTimes(1);
      const [logPayload] = loggerMock.error.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(Object.keys(logPayload).sort()).toEqual(
        ['errorMessage', 'subscriptionId'].sort(),
      );
      expect(logPayload.subscriptionId).toBe(SUBSCRIPTION_ID);
    });

    it('retorna undefined tanto en el camino feliz como ante error (void return)', async () => {
      instancesServiceMock.getOrCreateInstance.mockResolvedValue({
        id: 'instance-uuid',
      });

      const result = await listener.handleSubscriptionActivated(mockEvent);

      expect(result).toBeUndefined();
    });
  });
});
