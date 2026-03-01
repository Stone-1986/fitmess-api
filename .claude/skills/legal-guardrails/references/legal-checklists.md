# Legal Checklists — Referencia de implementacion

Checklists rapidos por tipo de HU, tipos de documento legal y schemas Prisma de audit trail.

## Tabla de contenido

1. [Checklist por tipo de HU](#1-checklist-por-tipo-de-hu)
2. [Tipos de documento legal](#2-tipos-de-documento-legal)
3. [Schemas Prisma — audit trail y legal acceptances](#3-schemas-prisma--audit-trail-y-legal-acceptances)

---

## 1. Checklist por tipo de HU

### HU de registro o perfil de usuario
- [ ] Ley 1581: aviso de privacidad + consentimiento explicito + finalidad declarada
- [ ] Ley 1273: password con bcrypt minimo 10 rondas, nunca en logs
- [ ] Ley 527: registro de aceptacion de terminos y habeas data en `legal_acceptances`

### HU de suscripcion a plan
- [ ] Ley 1581: consentimiento explicito para datos de salud (`HEALTH_DATA_CONSENT`)
- [ ] Ley 527: registro de consentimiento informado deportivo (`SPORT_CONSENT`) en `legal_acceptances`
- [ ] Ley 1273: solo coach del atleta puede ver sus datos (RI-03)

### HU de registro de resultados (RPE, dolor, motivacion)
- [ ] Ley 1581: datos sensibles de salud — verificar que existe consentimiento previo
- [ ] Ley 1273: no loggear valores de RPE, dolor ni motivacion en produccion
- [ ] Ley 1273: acceso restringido a coach del atleta y al propio atleta

### HU de autenticacion
- [ ] Ley 1273: passwords con bcrypt minimo 10 rondas
- [ ] Ley 1273: tokens JWT firmados, refresh tokens rotados
- [ ] Ley 1273: headers de autorizacion nunca en logs
- [ ] Ley 1273: rate limiting en endpoints de login

### HU de analisis IA
- [ ] Ley 1581: datos de salud usados solo para la finalidad declarada (analisis de desempeno)
- [ ] Ley 1273: `originalError` de Claude API nunca se expone al cliente

---

## 2. Tipos de documento legal

Valores del enum `DocumentType` para la tabla `legal_acceptances`:

| Valor | Descripcion | Cuando se registra |
|---|---|---|
| `HABEAS_DATA` | Aceptacion de politica de tratamiento de datos (RN-19) | Registro de usuario |
| `HEALTH_DATA_CONSENT` | Consentimiento para recoleccion de datos de salud | Suscripcion a plan |
| `SPORT_CONSENT` | Consentimiento informado deportivo (RN-20) | Suscripcion a plan |
| `TERMS_OF_SERVICE` | Aceptacion de terminos y condiciones | Registro de usuario |

**Sin UPDATE ni DELETE.** Cualquier intento lanza `BusinessError.LEGAL_ACCEPTANCE_IMMUTABLE`.

---

## 3. Schemas Prisma — audit trail y legal acceptances

### AuditLog — captura automatica de mutaciones

```prisma
model AuditLog {
  id            String   @id @default(uuid())
  userId        String?  @map("user_id")
  ip            String
  userAgent     String   @map("user_agent")
  method        String
  url           String
  statusCode    Int?     @map("status_code")
  duration      Int      // milliseconds
  correlationId String?  @map("correlation_id")
  error         String?
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([correlationId])
  @@map("audit_logs")
}
```

Registrado automaticamente por `AuditInterceptor` global en POST/PUT/PATCH/DELETE.

### LegalAcceptance — registro inmutable

```prisma
enum DocumentType {
  HABEAS_DATA
  HEALTH_DATA_CONSENT
  SPORT_CONSENT
  TERMS_OF_SERVICE
}

model LegalAcceptance {
  id              String       @id @default(uuid())
  userId          String       @map("user_id")
  documentType    DocumentType @map("document_type")
  documentVersion String       @map("document_version")
  ip              String
  userAgent       String       @map("user_agent")
  planId          String?      @map("plan_id")    // HEALTH_DATA_CONSENT, SPORT_CONSENT
  acceptedAt      DateTime     @default(now()) @map("accepted_at")

  @@index([userId])
  @@map("legal_acceptances")
}
```

Inmutabilidad por diseno: no existe metodo update ni delete en el service.

### AuditInterceptor — implementacion

```typescript
// src/modules/common/interceptors/audit.interceptor.ts
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            this.persistAuditLog(request, startTime, request.res?.statusCode);
          }
        },
        error: (error) => {
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            const statusCode = error instanceof HttpException ? error.getStatus() : 500;
            this.persistAuditLog(request, startTime, statusCode, error.message);
          }
        },
      }),
    );
  }

  private persistAuditLog(
    request: any,
    startTime: number,
    statusCode?: number,
    error?: string,
  ): void {
    this.prisma.auditLog.create({
      data: {
        userId: request.user?.id ?? null,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
        method: request.method,
        url: request.url,
        statusCode,
        duration: Date.now() - startTime,
        correlationId: request.correlationId,
        error,
      },
    }).catch((err) => this.logger.error('Error persistiendo audit log', err));
  }
}
```
