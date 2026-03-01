---
name: legal-guardrails
description: Guardarrails legales para fitmess-api. Cargar al implementar o revisar cualquier funcionalidad que involucre datos de usuarios, autenticación, datos de salud, consentimientos, contratos o transacciones digitales. Cubre Ley 1581/2012, Circular SIC No. 2/2024, Ley 1273/2009 y Ley 527/1999.
---

# Legal Guardrails — fitmess-api

Legislacion colombiana aplicable al proyecto. El Analista de Producto valida estos criterios en cada HU durante la fase de planificacion. El Desarrollador los implementa en codigo.

> Reglas absolutas de seguridad y privacidad → `.claude/rules/rulesArquitectura.md` seccion "Seguridad y privacidad"
> Schemas Prisma de `AuditLog`, `LegalAcceptance` y `AuditInterceptor` → [references/legal-checklists.md](references/legal-checklists.md) §3

---

## Tabla de Guardarrails

| Guardarrail | Ley | Cuando aplica | Que valida |
|---|---|---|---|
| **Consentimiento y datos personales** | Ley 1581/2012 + Circular SIC No. 2/2024 | Toda HU que involucre recoleccion o procesamiento de datos de usuarios | Aviso de privacidad, consentimiento explicito, finalidad declarada |
| **Seguridad de la informacion** | Ley 1273/2009 | Siempre — aplica a toda funcionalidad | Acceso no autorizado, logs de auditoria, cifrado de datos sensibles |
| **Validez de documentos digitales** | Ley 527/1999 | Solo si la HU involucra contratos, firmas o transacciones digitales | Autenticidad, integridad, disponibilidad |

---

## Guardarrail 1 — Consentimiento y Datos Personales

**Ley 1581 de 2012 + Circular SIC No. 2 de 2024**

### Cuando aplica

Toda funcionalidad que recolecte, almacene, procese o transmita datos de usuarios. En fitmess-api aplica especialmente a:
- Registro de atletas y coaches (`auth`)
- Datos de salud: RPE, dolor muscular, motivacion (`execution`)
- Suscripciones a planes de entrenamiento (`subscriptions`)
- Analisis IA sobre desempeno fisico (`ai`)

### Checklist de implementacion

- [ ] Hay aviso de privacidad presentado al usuario antes de recolectar datos?
- [ ] El consentimiento es **explicito** (accion afirmativa, no pre-marcado)?
- [ ] La finalidad del uso de los datos esta declarada y es especifica?
- [ ] Se registra en `legal_acceptances` con: `userId`, `documentType`, `documentVersion`, `acceptedAt`, `ip`, `userAgent`?
- [ ] Los datos sensibles de salud (RPE, dolor, motivacion) tienen consentimiento adicional especifico?
- [ ] El registro de aceptacion es **inmutable**? (sin UPDATE ni DELETE en `legal_acceptances`)

### Datos sensibles de salud — tratamiento especial

Los datos de RPE, dolor muscular y motivacion son **datos sensibles de salud** bajo Ley 1581:
- Requieren consentimiento explicito separado al registrar la suscripcion
- **Nunca** se loggean en produccion (ver `.claude/rules/rulesArquitectura.md`)
- Se almacenan en tablas separadas con acceso restringido
- Solo el coach del atleta y el propio atleta pueden acceder a ellos (RI-03)

### Implementacion en codigo

```typescript
// Registro de aceptacion legal — inmutable
// src/modules/subscriptions/subscriptions.service.ts

async acceptConsent(subscriptionId: string, athleteId: string, request: Request): Promise<void> {
  const subscription = await this.findOrFail(subscriptionId);

  // Verificar que no existe ya una aceptacion (inmutabilidad)
  const existing = await this.prisma.legalAcceptance.findFirst({
    where: { userId: athleteId, documentType: 'HEALTH_DATA_CONSENT', planId: subscription.planId },
  });

  if (existing) {
    throw new BusinessException(
      BusinessError.LEGAL_ACCEPTANCE_IMMUTABLE,
      'El consentimiento ya fue registrado y no puede modificarse',
      { documentType: 'HEALTH_DATA_CONSENT' },
    );
  }

  await this.prisma.legalAcceptance.create({
    data: {
      userId: athleteId,
      documentType: 'HEALTH_DATA_CONSENT',
      documentVersion: '1.0',
      planId: subscription.planId,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? 'unknown',
      // acceptedAt se auto-asigna via @default(now()) en Prisma schema
    },
  });
}
```

---

## Guardarrail 2 — Seguridad de la Informacion

**Ley 1273 de 2009**

### Cuando aplica

**Siempre.** Toda funcionalidad del sistema debe cumplir estos criterios.

### Checklist de implementacion

- [ ] El diseno evita acceso no autorizado a datos? (guards de autenticacion y autorizacion en todos los endpoints)
- [ ] Hay logs de auditoria para todas las mutaciones? (`AuditInterceptor` global en POST/PUT/PATCH/DELETE)
- [ ] Los datos sensibles estan cifrados? (passwords con bcrypt minimo 10 rondas, tokens JWT firmados)
- [ ] Las credenciales nunca se loggean? (passwords, tokens, refresh tokens, headers de autorizacion)
- [ ] Hay `correlationId` en cada request para trazabilidad end-to-end?
- [ ] Los errores expuestos al cliente no revelan detalles internos? (`originalError` solo en logs internos)

### Implementacion — pipeline de seguridad

```
Request
  |-- JwtAuthGuard          → 401 si token invalido o expirado
  |-- RolesGuard            → 403 si rol insuficiente
  |-- ResourcePolicyGuard   → 403 si no es dueno del recurso (RI-03)
  |-- WeekFrozenGuard       → 403 si semana cerrada
  |-- EditWindowGuard       → 403 si ventana de edicion expirada
  --- AuditInterceptor      → persiste log con userId, ip, metodo, url, statusCode, correlationId
```

> Pipeline completo (12 pasos) → skill `nestjs-conventions` §6

### Que NO loggear (regla absoluta)

```typescript
// NUNCA
this.logger.log(`Login: email=${email}, password=${password}`);
this.logger.log(`Token: ${accessToken}`);
this.logger.log(`RPE del atleta ${athleteId}: ${rpe}`);
this.logger.log(JSON.stringify(request.body)); // En produccion

// CORRECTO
this.logger.log(`Login exitoso para usuario ${userId}`);
this.logger.log(`Token generado para usuario ${userId}`);
this.logger.log(`Resultado registrado para sesion ${sessionId}`); // Sin datos de salud
```

---

## Guardarrail 3 — Validez de Documentos y Transacciones Digitales

**Ley 527 de 1999**

### Cuando aplica

**Solo** cuando la HU involucra alguno de estos escenarios:
- Firma de contratos o acuerdos digitales
- Transacciones economicas
- Documentos con valor legal (consentimientos informados, habeas data)

En fitmess-api aplica a: aceptacion de terminos, consentimiento informado deportivo (RN-20), habeas data (RN-19).

### Checklist de implementacion

- [ ] Se garantiza **autenticidad**? (el usuario esta autenticado cuando acepta — JWT valido)
- [ ] Se garantiza **integridad**? (el registro de aceptacion no puede modificarse despues)
- [ ] Se garantiza **disponibilidad**? (el registro persiste y es consultable para auditoria)
- [ ] Se registra la version exacta del documento aceptado? (`documentVersion` en `legal_acceptances`)
- [ ] Se registra el timestamp exacto con zona horaria? (`acceptedAt` con `@default(now())` en Prisma)

### Tipos de documento legal (`documentType`)

4 valores: `HABEAS_DATA`, `HEALTH_DATA_CONSENT`, `SPORT_CONSENT`, `TERMS_OF_SERVICE`.
**Sin UPDATE ni DELETE.** Cualquier intento lanza `BusinessError.LEGAL_ACCEPTANCE_IMMUTABLE`.

> Tabla completa de tipos con descripcion y momento de registro + Prisma schemas → [references/legal-checklists.md](references/legal-checklists.md) §2-3

---

## Checklist Rapido por Tipo de HU

> Checklists detallados por tipo de HU (registro, suscripcion, resultados, autenticacion, IA), tipos de `documentType` y schemas Prisma → [references/legal-checklists.md](references/legal-checklists.md)
