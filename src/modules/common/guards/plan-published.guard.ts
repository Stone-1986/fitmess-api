import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlanStatus } from '../../../../generated/prisma/index.js';
import { BusinessException } from '../exceptions/business.exception.js';
import { BusinessError } from '../exceptions/business-error.enum.js';

/**
 * PlanPublishedGuard — Temporal Guard (design-patterns skill §4).
 *
 * Protege las 10 rutas de estructura de EPICA-03 (agregar/quitar fase,
 * semana, sesion, ejercicio de sesion): solo proceden mientras el plan
 * sigue en Borrador (RN-31) — la duracion total y la estructura de
 * fases/semanas quedan inmutables una vez publicado el plan.
 *
 * Lee `request.params.id` (el `:id` del plan siempre esta presente en estas
 * rutas — decision D-9 del plan de implementacion). Si el plan no existe,
 * deja pasar sin lanzar: la verificacion de existencia + ownership real
 * (ENTITY_NOT_FOUND / RESOURCE_OWNERSHIP_DENIED) es responsabilidad de
 * findOwnedOrFail en el service, que corre justo despues en el mismo
 * request — este guard solo verifica la condicion temporal (estado del
 * plan), no existencia ni propiedad.
 */
@Injectable()
export class PlanPublishedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ params: Record<string, string> }>();
    const planId = request.params.id;

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { status: true },
    });

    if (plan && plan.status !== PlanStatus.DRAFT) {
      throw new BusinessException(
        BusinessError.PLAN_IMMUTABLE,
        `El plan '${planId}' no permite modificar su estructura en estado '${plan.status}' — solo procede en Borrador (RN-31)`,
        { planId, currentStatus: plan.status },
      );
    }

    return true;
  }
}
