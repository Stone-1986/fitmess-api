# Execution Log — EPICA-01: Gestión de Acceso y Cumplimiento Legal

## Fase 1 — Planificación (v1.0)

| # | Paso | Agente | Estado | Output | Notas |
|---|------|--------|--------|--------|-------|
| 1a | Validación de producto | product-analyst | OK | reporte_validacion_negocio.yaml | HU-001: APROBADA, HU-002: APROBADA, HU-003: APROBADA, HU-004: APROBADA_CON_CONDICIONES. escalamiento_requerido: true |
| 1b | Plan técnico | arquitecto | OK | plan_de_implementacion.yaml | 8 endpoints, 2 controllers (AuthController + CoachRequestsController), 12 decisiones arquitectónicas, 5 riesgos |
| 2 | Verificar conflictos | orquestador | DETENIDO → OK | — | Conflicto HU-004: Analista vs Arquitecto sobre fuerza bruta. Humano decidió: bloqueo por cuenta (5 intentos, 15 min). CA-4 agregado a HU-004. Conflicto resuelto. |
| 3 | Contrato OpenAPI | documentador | OK | contrato_openapi/ (18 archivos: 2 controllers, 11 DTOs, 4 enums, 1 README) | Checklist plan↔contrato: 11/11 puntos APROBADOS. Bloqueo por cuenta (429) documentado en login. |
| 4 | Schema Prisma | dba | OK | prisma/schema.prisma | 5 modelos nuevos (User, CoachRequest, LegalAcceptance, AuditLog, RefreshToken), 3 enums nuevos + 1 modificado (UserRole+ADMIN). prisma validate: OK |
| 5 | Spot-check | orquestador | OK | — | Contrato: @ApiProperty+validadores en DTOs, endpoints completos, no expone campos internos, bloqueo 429 documentado. Schema: 5 modelos, @@unique en email+identificationNumber, LegalAcceptance sin updatedAt, failedLoginAttempts+lockedUntil en User. Sin hallazgos. |
| 6 | CHECKPOINT 1 | orquestador | APROBADO | — | Humano aprobó. Migración Prisma ejecutada. |

## Fase 2 — Implementación (ciclo 1)

| # | Paso | Agente | Estado | Output | Notas |
|---|------|--------|--------|--------|-------|
| 1 | Implementación | desarrollador | OK | src/modules/auth/ (24 archivos) | 2 services, 2 controllers, 11 DTOs, 2 enums, 3 guards, 2 strategies, 2 decorators, 1 module. Registrado en app.module.ts. |
| 2 | QA | qa | OK | reporte_qa.yaml + 7 spec files + 1 e2e | 93 tests PASS. Lint: 263 errores (248 Prettier). Cobertura: no medida (coverage no configurado). Sin vulnerabilidades. |
| 3 | Revisión de código | lider-tecnico | RECHAZADO | revision_codigo.yaml | Linting FAIL, cobertura no medida, divergencias DTO código↔contrato en 8 DTOs. requiere_modificar_contrato: true. 3 temas para decisión humano. |
| 4 | Evaluación | orquestador | DETENIDO → OK | — | requiere_modificar_contrato: true → FLUJO DETENIDO. 3 decisiones del humano pendientes. |
| 5 | Decisiones humano | orquestador | OK | — | A: Incluir termsDocumentVersion/personalDataDocumentVersion en DTOs registro → SÍ. B: AuthTokenResponseDto anidado con expiresIn → SÍ. C: CoachRequestResponseDto ligero {id, status, createdAt, message} → SÍ. |
| 6 | Actualización contrato | orquestador | OK | contrato_openapi/ (4 DTOs modificados) | register-athlete.dto.ts, register-coach.dto.ts: +version fields. auth-token-response.dto.ts: reescrito anidado. coach-request-response.dto.ts: reducido a 4 campos. |

## Fase 2 — Implementación (ciclo 2)

| # | Paso | Agente | Estado | Output | Notas |
|---|------|--------|--------|--------|-------|
| 1 | Correcciones | desarrollador | OK | 14 archivos modificados | 4 DTOs entrada, 4 DTOs respuesta, 2 services, 4 tests. Campos renombrados, validadores agregados, estructura alineada con contrato. |
| 2 | QA | qa + orquestador | OK | reporte_qa.yaml (actualizado) | 93 tests PASS. Lint: 0 errores, 32 warnings. Prettier: OK. Cobertura: 96.44% global (dominio 98-100%, adaptadores 75-100%). 17/17 divergencias resueltas. Estado: APROBADO. |
| 3 | Revisión de código | lider-tecnico | RECHAZADO → OK | revision_codigo.yaml | LT detectó LoginDto sin @MaxLength(72) y LocalAuthGuard sin handleRequest(). Orquestador aplicó ambas correcciones directamente (triviales). Tests: 93 pass. Lint: 0 errores. Estado final: APROBADO. |

---

# Execution Log — EPICA-09: Registro y Autenticacion de Administradores

## Fase 1 — Planificación (v1.0)

| # | Paso | Agente | Estado | Output | Notas |
|---|------|--------|--------|--------|-------|
| 1a | Validación de producto | product-analyst | OK | reporte_validacion_negocio.yaml | 3 HUs APROBADA_CON_CONDICIONES. 2 bloqueantes (legal): HU-001 y HU-003 sin CA de aceptaciones legales. escalamiento_requerido: false |
| 1b | Plan técnico | arquitecto | OK | plan_de_implementacion.yaml | 3 endpoints (POST /admin-invitations, GET /admin-invitations/:token, POST /auth/admin/register) + 1 seed + 1 tarea técnica (EmailService). 10 decisiones arquitectónicas, 5 riesgos |
| 2 | Verificar conflictos | orquestador | OK | epica_input.yaml (actualizado) | Sin conflictos Analista↔Arquitecto. 2 bloqueantes resueltas: agregados CA de aceptaciones legales en HU-001 y HU-003. Condiciones no bloqueantes cubiertas por el plan |
| 3 | Contrato OpenAPI | documentador | OK | contrato_openapi/ (8 archivos: 2 controllers, 5 DTOs, 1 README) | Checklist plan↔contrato: 8/8 puntos APROBADOS. Campos legales obligatorios en RegisterAdminDto. security: [] en endpoints públicos. |
| 4 | Schema Prisma | dba | OK | prisma/schema.prisma | 1 modelo nuevo (AdminInvitation), 0 enums nuevos (estado derivado). tokenHash @unique, @@index([email]), onDelete: Restrict. User: +relación inversa. prisma validate: OK |
| 5 | Spot-check | orquestador | OK | — | Contrato: @ApiProperty+validadores en DTOs, endpoints completos, no expone campos internos, security: [] en públicos. Schema: AdminInvitation correcto, append-only, índice email justificado. Sin hallazgos. |
| 6 | CHECKPOINT 1 v1.0 | orquestador | FEEDBACK | — | Presentado al humano. Feedback: GET /admin-invitations/:token → POST /admin-invitations/verify (token sensible no debe ir en URL). Plan, contrato y DTO actualizados. |
| 7 | Corrección seguridad | orquestador | OK | plan + contrato actualizados | GET → POST /admin-invitations/verify. Nuevo DTO: VerifyAdminInvitationDto. Consistente con decisión #5 del plan y OWASP/RFC 7662. |
| 8 | CHECKPOINT 1 v1.1 | orquestador | APROBADO | — | Humano aprobó. Migración Prisma aplicada (20260309012821_epica_09_admin_invitation). |

## Fase 2 — Implementación (ciclo 1)

| # | Paso | Agente | Estado | Output | Notas |
|---|------|--------|--------|--------|-------|
| 1 | Implementación | desarrollador | OK | src/modules/auth/ + src/modules/notifications/ + prisma/seed.ts | NotificationsModule (EmailService + listener), AdminInvitationsService + Controller, 6 DTOs admin, registerAdmin en AuthService/Controller, seed.ts, 2 BusinessErrors nuevos. |
| 2 | QA | qa | OK | reporte_qa.yaml + 6 spec files | 149 tests PASS. Build: OK. Lint: 9 errores Prettier en 5 archivos. Cobertura: 99% dominio, 80% adaptadores. 17/17 criterios técnicos. 0 vulnerabilidades altas. Estado: RECHAZADO (solo formato). |
| 3 | Revisión de código | lider-tecnico | RECHAZADO → OK | revision_codigo.yaml | LT confirmó: único bloqueo Prettier. Patrones OK, consistencia contrato OK, 0 violaciones. Orquestador aplicó correcciones triviales: pnpm run format + 1 import no usado. Lint: 0 errores. Tests: 149 pass. Estado final: APROBADO. |

---

# Mantenimiento fuera del flujo de épicas

Cambios aplicados directamente en sesión con el humano, sin pasar por la cadena
Desarrollador → QA → Líder Técnico. Se registran aquí para que el log sea el
histórico completo del proyecto y no solo de las épicas. Los gates de calidad
(build, tsc, lint, prettier, cobertura) se aplican igual y se documentan abajo.

## 2026-08-05 — Rango de fechas en búsqueda de solicitudes (EPICA-01, HU-002)

| # | Paso | Responsable | Estado | Output | Notas |
|---|------|-------------|--------|--------|-------|
| 1 | Revisión de API | humano + Claude | OK | — | El humano propuso unificar los endpoints de búsqueda y agregar filtros. Se descartó fusionar `GET /coach-requests/:id` en `POST /search`: DTOs distintos (Detail expone phone, dateOfBirth, planDescription que Summary no), pérdida del 404 semántico y de la cacheabilidad del GET. Devolver el detalle en listas paginadas violaría minimización de datos (Ley 1581/2012 art. 4c). Los filtros propuestos (email, identificationNumber, createdAt) ya existían. |
| 2 | Hallazgo | Claude | BUG | — | `createdAt` se resolvía sobre el día UTC (`setUTCHours` sobre `new Date('YYYY-MM-DD')`). Un admin en Colombia (UTC-5) no veía las solicitudes creadas después de las 19:00 hora local: en UTC ya pertenecían al día siguiente. Faltaban resultados en silencio. |
| 3 | Corrección | humano + Claude | OK | `coach-requests/` (6 archivos), `contrato_openapi/` (2 DTOs) | `createdAt` → `createdAtFrom` / `createdAtTo`, opcionales e independientes, resueltos con offset fijo `-05:00` (Colombia no observa DST). Nuevo `@IsOnOrAfter` en `coach-requests/validators/`: rango invertido responde 400 en vez de lista vacía. Formato restringido a `YYYY-MM-DD` porque el service compone la hora sobre el valor. |
| 4 | Contrato | humano + Claude | OK | `contrato_openapi/dto/` + `contrato_openapi/src/modules/auth/dto/` | Ambas copias del DTO actualizadas (EPICA-01 y EPICA-09) + descripción de `@ApiOperation` en el controller. |
| 5 | Verificación | humano + Claude | OK | — | 162 tests PASS (antes 149; +5 en service asertando el `where` construido, +9 de DTO). Build: OK. `tsc --noEmit`: OK. Lint: 0 errores (32 warnings preexistentes). Prettier: OK. Cobertura: 94.38% global · coach-requests 98.43% · validators 100%. |
| 6 | Commit | humano | OK | `4672658` | `fix(auth): corregir zona horaria y soportar rango de fechas`. BREAKING CHANGE: con `forbidNonWhitelisted: true` activo, los clientes que envíen `createdAt` reciben 400. |

## 2026-08-05 — Revisión crítica del modelo de implementación

Disparada por el humano al detectar que `implementar-epica` exige que el execution-log exista pero nunca lo lee. La revisión encontró tres problemas más graves que ese.

| # | Hallazgo | Evidencia | Corrección |
|---|----------|-----------|------------|
| 1 | Los artefactos de la épica aprobada dicen `RECHAZADO`. El commit taggeado `EPICA-09/checkpoint-2` contiene `reporte_qa.yaml:342` y `revision_codigo.yaml:196` ambos en `estado: "RECHAZADO"` sobre código aprobado. | Causa: el orquestador aplicó las correcciones triviales y siguió sin re-lanzar QA/LT ni reescribir los YAML. | Nuevo **Paso 4.5** en `implementar-epica`: lista blanca cerrada de correcciones triviales + obligación de re-correr gates y reescribir `estado:` en ambos artefactos. Verificación explícita antes del CHECKPOINT 2. |
| 2 | El último gate no puede verificar nada. El LT no tiene Bash (`lider-tecnico.md:257`) y decide sobre números que el QA se autorreporta — el mismo agente escribe los tests, mide su cobertura y declara si pasó. | El prompt del QA tiene ~15 líneas defensivas (`NUNCA escribir PENDIENTE_EJECUCION_REAL`) y existe el commit `ea08b65` "reforzar ejecución bash del QA": el sistema ya falló por aquí. | Nuevo **Paso 2.5**: el orquestador ejecuta `test:cov`, `lint`, `prettier --check` y `build`, contrasta contra el YAML del QA y pasa la salida cruda al LT en el prompt. Discrepancia → QA inválido, relanzar una vez, luego escalar. |
| 3 | El orquestador hacía de desarrollador sin que estuviera escrito. Ocurrió en las dos épicas (log líneas 32 y 58); `implementar-epica` no lo mencionaba. | — | Formalizado en el Paso 4.5 con lista blanca cerrada. |
| 4 | El execution-log era de solo escritura (hallazgo original del humano). | `planificar-epica:28` lo crea, `implementar-epica:25` verifica que exista, `:31` sigue escribiendo. Ningún agente lo lee. | Ahora es input: el orquestador lo lee antes del Paso 1 y el LT lo tiene en su lista de lectura, con instrucción de detectar errores que se repiten entre épicas. |
| 5 | El contrato se bifurcó en dos layouts **y el segundo estaba degradado**. El Documentador de EPICA-09 regeneró los DTOs de EPICA-01 desde su propio plan: los 13 archivos duplicados diferían y `athlete-registration-response.dto.ts` había perdido `name`, `role` e `identificationType` (33 líneas vs 75). | Verificado contra `src/modules/auth/core/dto/athlete-registration-response.dto.ts`, que tiene los 9 campos del layout original. | Layout canónico único: `contrato_openapi/src/modules/[module]/[feature]/` espejando `src/`. Migrados 22 archivos conservando el contenido correcto, eliminadas las copias degradadas y los enums locales (imports → `generated/prisma`). `documentador.md` ahora prohíbe regenerar contrato ajeno al plan propio. |

Verificación tras los cambios: build OK, 162 tests PASS. `outputs/` está excluido de ambos tsconfig, así que la reorganización del contrato no afecta compilación.

## 2026-08-05 — Saneamiento del gate de cobertura

Salió de una pregunta del humano sobre si la cobertura era agregada o por archivo. La respuesta destapó que el gate nunca midió lo que decía medir.

| # | Paso | Responsable | Estado | Notas |
|---|------|-------------|--------|-------|
| 1 | Diagnóstico | humano + Claude | BUG | `root: './src'` + `include: ['src/**/*.ts']` → patrón `src/src/**` que no coincide con nada. v8 reportaba solo los 19 archivos que algún test cargaba, de 36. Real: 71.38%, no 94.38%. |
| 2 | Corregir patrones | humano + Claude | OK | `include: ['**/*.ts']` y `exclude` relativos a `root`. Comentario en el archivo explicando la trampa para que nadie la reintroduzca. |
| 3 | Exclusiones legítimas | humano + Claude | OK | Solo barriles `index.ts` y `*.interface.ts` — sin lógica ejecutable. **Movieron el número 0 puntos**: no había ganancia fácil, los 101 statements sin cubrir eran código real. Se dejó `prisma.service.ts` dentro (tiene constructor y lifecycle hooks); excluirlo habría sido maquillaje. |
| 4 | Tests de los 2 filters | humano + Claude | OK | `global-exception.filter.spec.ts` (13 tests) y `prisma-exception.filter.spec.ts` (18). Cubren el contrato RFC 9457 y —lo que más valor tiene— que ni el mensaje del error ni el de Prisma lleguen al cliente. Esa regla de `rulesArquitectura` sobre `originalError` no tenía verificación hasta hoy. |
| 5 | Hallazgo: specs falsos | Claude | BUG | **Tres** specs de controller (`core/auth.controller.spec.ts`, `admin-invitations/admin-invitations.controller.spec.ts`, `admin-invitations/auth.controller.register-admin.spec.ts`) construían una réplica del controller a mano (`controllerBehavior`) en vez de importar la clase real. 26 tests pasaban sin ejecutar una línea de producción — cobertura 0%. Justificaban con un fallo al importar `express`. |
| 6 | Verificar la justificación | Claude | OK | Se probó el import con un spec desechable: **funciona**. No hizo falta instalar `express` — `@nestjs/platform-express` ya es dependencia directa. El diagnóstico original era incorrecto. |
| 7 | Reconectar los 3 specs | humano + Claude | OK | `Test.createTestingModule` mockeando solo el service, igual que `coach-requests.controller.spec.ts`, que siempre estuvo bien. Los 3 controllers pasan de 0% a 100%. Se agregaron asserts que la réplica no permitía: propagación de excepciones sin try/catch, y que la respuesta no expone `invitationToken` ni `passwordHash`. Cada spec lleva nota de por qué cambió, para que no se revierta. |
| 8 | Cerrar el gate | humano + Claude | OK | Faltaban 3 funciones para el 80%. `health.controller.spec.ts` (5 tests) las aporta ejecutando el indicador de Terminus, no solo la llamada externa. |
| 9 | Verificación | humano + Claude | OK | 206 tests PASS en 17 archivos (antes 162 en 14). Cobertura 85.83 / 82.41 / 80.28 / 85.95 — las cuatro métricas sobre threshold, `test:cov` exit 0. Lint 0 errores, Prettier OK, build OK, `tsc --noEmit` OK. |

**Impacto en el modelo:** el Paso 2.5 que se agregó a `implementar-epica` este mismo día hace que el orquestador ejecute los gates en vez del QA. Eso no habría servido de nada mientras el comando midiera mal. Arreglar quién ejecuta el gate y arreglar qué mide el gate son problemas distintos y hacían falta los dos.

## 2026-08-05 — Reparación de la suite e2e

Salió de un inventario del estado del proyecto: `pnpm run test:e2e` fallaba 7 de 20 tests y nadie lo había notado porque el comando no está en el gate.

| # | Paso | Responsable | Estado | Notas |
|---|------|-------------|--------|-------|
| 1 | Diagnóstico | humano + Claude | BUG | El spec enviaba `acceptedPersonalDataPolicy` / `acceptedTermsOfService` / `acceptedTerms`; los DTOs esperan `acceptsHabeasData` / `acceptsTermsOfService`. Con `forbidNonWhitelisted: true` todo registro respondía 400, y los tests de login fallaban en cascada porque el usuario nunca llegaba a existir. Nombres de campo desactualizados, no un bug de producción. |
| 2 | Hallazgo colateral | Claude | BUG | **Las aceptaciones legales no se validaban.** Los tres DTOs de registro (atleta, coach, admin) declaraban `acceptsHabeasData` y `acceptsTermsOfService` con `@IsBoolean` únicamente — `false` es un booleano válido. El service escribe `LegalAcceptance` incondicionalmente, sin leer el campo. Un cliente que enviara `false` quedaba registrado **y con un registro en `legal_acceptances` afirmando que consintió**. Los docblocks de los tres DTOs ya decían "Ambos obligatorios" y "Debe ser true para completar el registro": el código nunca implementó su propio contrato. |
| 3 | Corrección de producción | humano + Claude | OK | `@Equals(true)` con mensaje en español en los 6 campos (2 por DTO × 3 DTOs). Validación estructural en el DTO, sin tocar services — consistente con `rulesCodigo § DTOs y Validadores`. Ley 1581/2012 art. 9 exige consentimiento previo y expreso; fabricar el registro de aceptación es peor que no tenerlo. |
| 4 | Contrato | humano + Claude | OK | Las 3 copias en `outputs/contrato_openapi/src/modules/auth/**/dto/` actualizadas con el mismo decorador, manteniendo su estilo acentuado. |
| 5 | Reescritura del spec | humano + Claude | OK | Payloads por factory (`buildAthletePayload` / `buildCoachPayload`) en vez de constantes compartidas: cada test genera su propio usuario y ya no depende del orden. Prefijo `RUN_ID` por corrida + `deleteMany` en `afterAll` — antes cada ejecución dejaba usuarios huérfanos en la DB. Los dos tests de 409 usaban `if (status === 409)`, así que pasaban aunque el endpoint respondiera cualquier cosa; ahora registran y re-registran el mismo payload y exigen 409. |
| 6 | Tests que ahora verifican algo | humano + Claude | OK | El test de HEALTH_DATA_CONSENT solo comprobaba que el 201 llegara — su propio comentario lo admitía. Ahora consulta `legal_acceptances` vía `PrismaService` y asegura que los tipos sean exactamente `[HABEAS_DATA, TERMS_OF_SERVICE]` y que las versiones aceptadas queden trazadas (Ley 527/1999). Nuevos: no exposición de `passwordHash`, rechazo de campo desconocido, consentimiento en `false` para atleta y coach, cuenta bloqueada rechazando la password correcta, y los dos casos de `POST /admin-invitations/verify` (400 por formato, 404 sin filtrar el token en la respuesta). |
| 7 | Discrepancia contrato/código | Claude | ABIERTO | El test "400 cuando falta email" en login era inalcanzable: en NestJS los guards corren antes que los pipes, así que `LocalAuthGuard` responde 401 antes de que el `ValidationPipe` mire el `LoginDto`. El test ahora asserta 401 con la explicación en el código. Queda abierto qué hacer con `@ApiProblemResponse(400)` del endpoint — ver hallazgo #3. |
| 8 | Verificación | humano + Claude | OK | e2e 28/28 PASS (antes 13/20). Unitarios 235 PASS, cobertura 90.93 / 87.43 / 87.32 / 90.83 sin cambio. `tsc --noEmit` OK, build OK, Prettier OK, lint 0 errores (45 warnings, todos `no-unsafe-argument` preexistentes por `app.getHttpServer()`). |

**Lección para el modelo:** el hallazgo #2 lo destapó arreglar los tests, no escribirlos. Los unitarios llamaban al service directamente, así que nunca pasaron por el `ValidationPipe` y no podían ver el hueco. Un e2e roto es un gate apagado.

## 2026-08-05 — Mayoría de edad en el registro

El humano reportó dos registros que la API aceptaba: uno con `dateOfBirth` en el futuro (menor de edad) y otro con ambos consentimientos en `false`.

| # | Paso | Responsable | Estado | Notas |
|---|------|-------------|--------|-------|
| 1 | Reproducción | humano + Claude | — | El caso de los consentimientos **ya estaba corregido**: el servidor del humano llevaba corriendo desde las 10:47 con el `dist` anterior al `@Equals(true)`. Se confirmó levantando el build actual: 400 en los tres casos. Lección operativa: al validar un fix contra un servidor local hay que verificar la hora de arranque del proceso, no solo el código en disco. |
| 2 | Hallazgo confirmado | Claude | BUG | **Sin validación de edad.** `dateOfBirth` solo tenía `@IsOptional()` + `@IsDateString()`. Aceptaba fechas futuras (`2026-11-22` con "hoy" en 2026-08-05), menores de edad y fechas absurdas. Ningún documento de la épica define una regla de edad — nunca se especificó. |
| 3 | Decisión del humano | humano | OK | 18 años cumplidos, sin fechas futuras, tope de 120 años, mismo umbral para atleta, entrenador y administrador. |
| 4 | Campo obligatorio | Claude | BREAKING | `dateOfBirth` era opcional en los tres DTOs: una puerta de edad sobre un campo opcional se evade omitiendo el campo. Pasa a requerido. Es un breaking change — los clientes que no lo envíen reciben 400. Se avisó al humano al aplicarlo. |
| 5 | Validador | humano + Claude | OK | Nuevo `shared/validators/is-legal-age-birth-date.validator.ts`. Un solo decorador cubre formato, existencia real de la fecha, futuro, tope de 120 y mayoría de edad — son la misma pregunta y separarlos daría varios errores simultáneos sobre el mismo campo. Aritmética de calendario pura (sin `Date` para comparar) y día calendario **colombiano**, no UTC: entre las 19:00 y las 23:59 hora local UTC ya está en el día siguiente y alguien que cumple 18 mañana pasaría. Mismo criterio que el filtro de fechas de coach-requests. Formato restringido a `YYYY-MM-DD` porque el service persiste con `new Date(...)` y una cadena con hora y offset guardaría un instante distinto según la zona del cliente. |
| 6 | Hallazgo colateral | Claude | BUG | **`registerCoach` descartaba `dateOfBirth`.** El DTO lo aceptaba y el `user.create` de `auth.service.ts:157` no lo incluía — solo `registerAthlete` y `registerAdmin` lo persistían. `coach-requests.service.ts:225` expone ese campo en el detalle que el admin revisa, así que siempre le llegaba `null`. Poner una puerta de edad al entrenador y luego botar la fecha habría dejado el arreglo a medias. Corregido y cubierto con un test e2e que lee la fila. |
| 7 | Tests | humano + Claude | OK | 21 unitarios del validador con reloj congelado (`vi.setSystemTime`) — los casos de límite (cumple hoy / cumple mañana / 29 de febrero / medianoche colombiana) dejarían de valer con el tiempo si no. 6 e2e nuevos: menor de edad en atleta y en entrenador, fecha futura, más de 120 años, campo ausente, y persistencia de la fecha del entrenador. |
| 8 | Contrato | humano + Claude | OK | Las 3 copias de `outputs/contrato_openapi/` actualizadas: `@ApiPropertyOptional` → `@ApiProperty`, `dateOfBirth?` → `dateOfBirth`, decorador nuevo. |
| 9 | Verificación | humano + Claude | OK | e2e 34/34 PASS (antes 28). Unitarios 256 PASS en 21 archivos (antes 235 en 20). Cobertura 91.83 / 89.68 / 88.75 / 91.70 — sube desde 90.93; el validador queda al 100%. `tsc --noEmit` OK, build OK, Prettier OK, lint 0 errores. Verificado además contra el servidor real con los payloads exactos del reporte: ambos 400 con el motivo preciso por campo. |
| 10 | Limpieza | Claude | OK | Se borraron los 11 usuarios que las pruebas manuales dejaron en la DB. Quedan los 2 registros de prueba del humano (`jfonseca@ejemplo.com`, `fonseca@ejemplo.com`) — decisión suya, ver hallazgo #5. |

## 2026-08-05 — `start:prod` roto y purga de registros inválidos

| # | Paso | Responsable | Estado | Notas |
|---|------|-------------|--------|-------|
| 1 | Purga | humano + Claude | OK | El humano autorizó borrar `jfonseca@ejemplo.com` y `fonseca@ejemplo.com`. Se inspeccionaron antes las filas dependientes: 4 `legal_acceptances` (las 2 de `fonseca@` eran las fabricadas), 0 refresh tokens, 0 solicitudes de entrenador, 0 invitaciones creadas. Borrados los 2 usuarios; la cascada eliminó las 4 aceptaciones. Estado final: 3 usuarios (los originales de EPICA-01 y el admin del seed) y 6 aceptaciones legítimas. |
| 2 | Diagnóstico `start:prod` | Claude | BUG | `node dist/main` falla con `MODULE_NOT_FOUND: @prisma/client-runtime-utils`. El cliente se genera en `generated/prisma/` (raíz del proyecto, fuera de `node_modules/`) y su runtime hace `require("@prisma/client-runtime-utils")`, un transitivo de `@prisma/client`. Node resuelve subiendo hasta `<raíz>/node_modules`, donde la resolución estricta de pnpm solo enlaza dependencias **directas** — el paquete únicamente existía dentro del store virtual. |
| 3 | Por qué no se veía | Claude | — | `nest start` lo enmascaraba: los shims de pnpm (`node_modules/.bin/nest`) exportan `NODE_PATH` incluyendo `.pnpm/node_modules`, donde sí está todo lo transitivo hoisteado, y el `node dist/main` que el CLI lanza heredaba esa variable. Confirmado empíricamente: `NODE_PATH=.pnpm/node_modules node dist/main` arranca; sin ella, no. Funcionaba en desarrollo y habría fallado en el primer despliegue. |
| 4 | Corrección | humano + Claude | OK | `publicHoistPattern: ['@prisma/*']` en `pnpm-workspace.yaml` (donde el proyecto ya guarda su configuración de pnpm), con el porqué documentado en el archivo. Se prefirió sobre declarar `@prisma/client-runtime-utils` como dependencia directa: eso obligaría a sincronizar a mano la versión de un paquete interno cada vez que se actualice `@prisma/client`. Tras `pnpm install`, los 14 paquetes `@prisma/*` quedan enlazados en `node_modules/`. `pnpm-lock.yaml` no cambia — el hoisting altera el layout, no el grafo de dependencias. |
| 5 | Verificación | humano + Claude | OK | `env -u NODE_PATH node dist/main` arranca. `pnpm run start:prod` responde `health` 200 con `database: up` y rechaza con 400 el registro de un menor. Gates tras el reinstall: 256 unitarios PASS, e2e 34/34, cobertura 91.83%, `tsc --noEmit` OK, build OK, Prettier OK, lint 0 errores. |

## 2026-08-05 — `test:e2e` incorporado al gate

Cierre del hallazgo #4. El Paso 2.5 verificaba cuatro comandos y ninguno tocaba el pipeline HTTP.

| # | Paso | Responsable | Estado | Notas |
|---|------|-------------|--------|-------|
| 1 | Gate del orquestador | humano + Claude | OK | `implementar-epica` Paso 2.5: cuatro comandos → cinco, con `pnpm run test:e2e` (timeout 300000). Agregado al prompt del QA (paso 2), a la salida cruda que recibe el LT (paso 3) y a la re-ejecución de la ruta rápida del Paso 4.5. |
| 2 | Distinción entorno vs código | humano + Claude | OK | El e2e es el único gate que puede fallar por causas ajenas al código. Se documentó una tabla de dos filas: error de conexión a la DB → `NO_EJECUTADO` y **escalar al humano**; asserts que fallan → ciclo de corrección normal. Regla explícita en los tres artefactos: un e2e que no corre nunca cuenta como aprobado, porque es indistinguible de uno que pasa. |
| 3 | Agente QA | humano + Claude | OK | Nuevo paso §1.5 en `qa.md` con el comando, la tabla de modos de falla y la obligación de cubrir en e2e todo endpoint nuevo o modificado (happy path, rechazo de validación, y sin autenticación si es protegido). Nueva sección `tests:` en el YAML del reporte con `unitarios` y `e2e` (incluye `NO_EJECUTADO` y `motivo_no_ejecutado`). |
| 4 | Agente Líder Técnico | humano + Claude | OK | Nuevo bloque "Suite e2e (gate duro)" en §1: cualquier fallo bloquea, `NO_EJECUTADO` escala, y si la épica agregó endpoints que no aparecen en la suite es un hallazgo — la cobertura agregada puede estar en verde mientras el pipeline HTTP de esos endpoints no se ejercita. |
| 5 | Rules | humano + Claude | OK | `rulesArquitectura § Testing`: `test:e2e` declarado gate duro equivalente a cobertura y linting, con el porqué (única capa que atraviesa `ValidationPipe`, guards, interceptores y filters) y la regla de escalamiento si no hay DB. |
| 6 | Hallazgo colateral | Claude | BUG | **El gate de formato dejaba fuera los e2e.** Los artefactos mandaban `npx prettier --check 'src/**/*.ts'`, pero ya existía el script `format:check` que cubre `src/` **y** `test/`. Los `.e2e-spec.ts` nunca pasaron por el gate de formato. Reemplazado por `pnpm run format:check` en los 5 lugares que lo invocaban, con nota de por qué no volver al glob de `src/`. |
| 7 | Diseño conceptual | humano + Claude | OK | Nueva §9.2.1 "Gate e2e" en `diseñoConceptual.md`, en paralelo a la de cobertura. De paso se corrigieron dos datos obsoletos de §9.2: los thresholds decían 75/75/70/75 cuando `vitest.config.ts` tiene 80/80/75/80, y el gatillo decía "ejecutado por el QA" cuando desde el Paso 2.5 lo ejecuta el orquestador. |
| 8 | Verificación | humano + Claude | OK | Secuencia completa de los cinco gates ejecutada tal como quedó escrita: `test:cov` 256 PASS · `test:e2e` 34/34 PASS · `lint` 0 errores · `format:check` OK · `build` OK. |

**Lección para el modelo:** los dos huecos de este día —`test:e2e` fuera del gate y `format:check` sin usar— son el mismo patrón: el comando correcto existía en `package.json` y los artefactos de proceso invocaban otra cosa. Al agregar un gate conviene revisar primero qué scripts ya están definidos antes de escribir el comando a mano.

### Extensión — `test:e2e` en el hook pre-commit

| # | Paso | Responsable | Estado | Notas |
|---|------|-------------|--------|-------|
| 1 | Hook | humano + Claude | OK | `.husky/pre-commit` ejecuta `pnpm run test:e2e` después de lint-staged y `tsc --noEmit`. Condicionado a que el commit toque `src/`, `test/`, `prisma/`, `package.json` o `vitest.config*` — un commit de documentación, de `.claude/` o de `outputs/` no puede romper el pipeline HTTP y no justifica ~20s. |
| 2 | Decisión: DB caída no bloquea | humano + Claude | OK | Si la salida contiene `Can't reach database server`, el hook **avisa y deja pasar**. Bloquear obligaría a usar `git commit --no-verify` para trabajar sin DB, y eso apagaría también lint-staged y `tsc`: un gate que empuja a saltarse todos los gates es peor que un gate ausente. El gate autoritativo sigue siendo el Paso 2.5, que sí escala. Si los tests corren y fallan de verdad, el commit se bloquea. |
| 3 | Detalle de shell | Claude | OK | Husky ejecuta el hook con `sh -e` (verificado en `.husky/_/h`), así que cualquier comando que falle aborta solo. Por eso el e2e usa `\|\| e2e_status=$?`: mantiene el fallo dentro de una lista condicional para poder clasificarlo antes de decidir si bloquea. Se comprobó también que la cadena existente ya abortaba bien — no había un hueco previo que arreglar. |
| 4 | Verificación de las 4 ramas | humano + Claude | OK | Se generó un arnés desde el archivo real (`sed` sobre `.husky/pre-commit`) para no probar una copia divergente. **A)** DB arriba + tests verdes → exit 0 silencioso. **B)** `DATABASE_URL` a un puerto muerto → advertencia, exit 0. **C)** spec temporal que falla a propósito → imprime la salida completa, mensaje de bloqueo, exit 1 (spec eliminado después). **D)** matcher de rutas probado con 9 rutas: dispara en `src/`, `test/`, `prisma/`, `package.json`, `vitest.config.ts`; omite `.claude/`, `outputs/`, `README.md`, `CLAUDE.md`. Hook real con índice vacío: 4.9s, omite el e2e, exit 0. |
| 5 | Documentación | humano + Claude | OK | `rulesArquitectura § Testing`, `diseñoConceptual §9.1` (reescrita: ahora es "Linting + Compilacion + e2e") y `guia-de-uso.md` con una subsección que explica al desarrollador qué significa la advertencia cuando aparece. |

## Hallazgos abiertos

Detectados fuera del flujo de agentes y aún sin resolver.

| # | Hallazgo | Detectado | Severidad | Estado |
|---|----------|-----------|-----------|--------|
| 5 | ~~**Dos filas en `users` con datos inválidos bajo las reglas actuales**~~, creadas por el humano al reportar el bug de edad: `jfonseca@ejemplo.com` y `fonseca@ejemplo.com`, ambas con `dateOfBirth = 2026-11-22` (futura). La segunda es la más grave: se registró enviando `acceptsTermsOfService: false` y `acceptsHabeasData: false`, y aun así tiene sus dos filas en `legal_acceptances` **afirmando que consintió** — el service las escribía sin leer el campo. Es exactamente el registro de consentimiento fabricado que describe la entrada de mantenimiento de los DTOs. **RESUELTO** el 2026-08-05: el humano autorizó el borrado; se eliminaron los 2 usuarios y las 4 aceptaciones en cascada. | 2026-08-05 | Media | RESUELTO |
| 6 | ~~**`pnpm run start:prod` no arranca.**~~ `node dist/main` falla con `MODULE_NOT_FOUND: @prisma/client-runtime-utils`, requerido por `generated/prisma/runtime/client.js`. Es la resolución estricta de pnpm: el paquete no es dependencia directa y no queda enlazado en `node_modules/`. `pnpm run start` (que va por `nest start`) sí funciona, y por eso el problema pasa inadvertido en desarrollo. Afecta el despliegue, donde el comando de producción es justamente `start:prod`. Detectado al intentar levantar el build para verificar un fix. **RESUELTO** el 2026-08-05 con `publicHoistPattern: ['@prisma/*']` — ver entrada de mantenimiento del mismo día. | 2026-08-05 | Alta | RESUELTO |
| 4 | ~~**`pnpm run test:e2e` no está en ningún gate.**~~ El Paso 2.5 de `implementar-epica` ejecuta `test:cov`, `lint`, `prettier --check` y `build`, pero no el e2e. Por eso la suite llevaba roto desde que los DTOs cambiaron de `accepted*` a `accepts*` sin que nadie lo viera, y por eso el hueco de validación de consentimientos sobrevivió a dos épicas. Los unitarios no pueden cubrirlo: llaman al service directamente, sin `ValidationPipe`. Decisión pendiente: agregarlo al Paso 2.5 exige una DB disponible en el entorno donde corre el gate. **RESUELTO** el 2026-08-05 — agregado como quinto gate; el caso "DB no disponible" se resuelve con el estado `NO_EJECUTADO` que escala al humano en vez de aprobar. Ver entrada de mantenimiento del mismo día. | 2026-08-05 | Alta | RESUELTO |
| 3 | `POST /auth/login` documenta `@ApiProblemResponse(400, 'Error de validacion...')` (`auth.controller.ts:218`) pero el runtime nunca puede producirlo: `LocalAuthGuard` corre antes que el `ValidationPipe` (guards antes que pipes en NestJS), así que un body sin `email` responde 401 INVALID_CREDENTIALS. Dos salidas posibles y no equivalentes: (a) quitar el 400 del contrato y aceptar 401 como respuesta a body malformado, o (b) validar el body antes del guard para que el 400 sea real. Requiere decisión del humano — (b) toca la ruta de autenticación. | 2026-08-05 | Baja | ABIERTO |
| 2 | **El gate de cobertura medía la mitad del código.** `vitest.config.ts` tiene `root: './src'`, y los patrones de coverage se resuelven relativos a `root` — así que `include: ['src/**/*.ts']` buscaba `src/src/**/*.ts` y no coincidía con nada. Sin `include` efectivo, v8 solo reportaba los archivos que algún test cargaba: 19 de 36. Los otros 17 no sumaban al numerador **ni al denominador**. El 94.38% reportado era en realidad 71.38%, por debajo de los thresholds. **CORREGIDO** el 2026-08-05 — ver entrada de mantenimiento del mismo día. | 2026-08-05 | Alta | RESUELTO |
| 2b | Deuda de cobertura remanente tras corregir el hallazgo #2. El gate pasa (90.93%) pero siguen en 0%: `validation-exception.filter.ts`, `response.interceptor.ts` (envelope de **toda** respuesta de la API), `correlation-id.middleware.ts`, `prisma.service.ts`. Parciales: `jwt-auth.guard.ts` (50%, líneas 27-36), `current-user.decorator.ts` (33%), `public.decorator.ts` (50%). El agregado los tapa. **Saldado hasta ahora (2026-08-05):** los 4 exception filters menos el de validación, la ruta de login (`local.strategy.ts` + `local-auth.guard.ts`) y `health.controller.ts` — todos al 100%. Decisión pendiente aparte: si `rulesArquitectura § Testing` se lee por archivo, activar `thresholds.perFile`; si es agregada, decirlo explícitamente en la regla. Hoy la regla y la herramienta no dicen lo mismo. | 2026-08-05 | Media | ABIERTO |
| 1 | `AuditLog` está definido en `prisma/schema.prisma:121` y su tabla existe desde la migración de EPICA-01, pero **ningún archivo de `src/` escribe en ella** — la tabla está vacía. Sus campos (`method`, `url`, `statusCode`, `duration`, `correlationId`) son de nivel HTTP: fueron pensados para un interceptor global que nunca se implementó. Impacto: EPICA-01 es "Gestión de Acceso y Cumplimiento Legal" y no hay rastro de quién consulta datos personales. Nota adicional: `POST /coach-requests/search` permite buscar por `identificationNumber` exacto; como los criterios viajan en el body, un interceptor genérico registraría la llamada pero no por qué documento se buscó. | 2026-08-05 | Media | ABIERTO |
