/**
 * prisma/seed.ts — Seed del administrador inicial (HU-001, EPICA-09)
 *
 * Uso: pnpm prisma db seed
 *
 * IMPORTANTE: Este script usa PrismaClient con PrismaPg adapter (consistente
 * con el resto de la aplicacion). Se ejecuta una sola vez como bootstrap.
 *
 * Comportamiento:
 * - Si ADMIN_SEED_EMAIL o ADMIN_SEED_PASSWORD no estan definidas → exit(0) informativo
 * - Si el email ya existe en User → skip (idempotencia) → exit(0)
 * - Si la password no cumple requisitos (min 8 chars, al menos 1 letra y 1 numero) → exit(1)
 * - Si todo OK → crea User(ADMIN) + LegalAcceptance(HABEAS_DATA) + LegalAcceptance(TERMS_OF_SERVICE)
 *
 * Guardrails legales:
 * - Ley 1581/2012 + Decreto 1377/2013: registra HABEAS_DATA y TERMS_OF_SERVICE
 *   en legal_acceptances (condicion bloqueante HU-001 del Analista de Producto)
 * - Ley 527/1999: registro inmutable de aceptaciones con timestamp y datos del entorno
 * - Ley 1273/2009: la password NUNCA se loggea en consola
 *
 * Trazabilidad de auditoria (condicion no bloqueante HU-001):
 * - El seed imprime en consola el timestamp y el email del admin creado (sin password)
 * - La ip se registra como '127.0.0.1' (seed ejecutado en entorno de despliegue local/CI)
 * - La userAgent se registra como 'prisma/seed' para distinguir la fuente
 */

import { PrismaClient, DocumentType, UserRole, IdentificationType } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

// Requisitos de password: min 8 chars, al menos una letra y un numero
const PASSWORD_PATTERN = /(?=.*[a-zA-Z])(?=.*\d)/;
const PASSWORD_MIN_LENGTH = 8;

// Valores por defecto para campos obligatorios del seed
const SEED_IDENTIFICATION_TYPE = IdentificationType.CC;
const SEED_PHONE_COUNTRY_CODE = '57';
const SEED_TERMS_DOCUMENT_VERSION = 'v1.0';
const SEED_HABEAS_DATA_DOCUMENT_VERSION = 'v1.0';
const SEED_IP = '127.0.0.1';
const SEED_USER_AGENT = 'prisma/seed';

async function main(): Promise<void> {
  const email = process.env['ADMIN_SEED_EMAIL'];
  const password = process.env['ADMIN_SEED_PASSWORD'];
  const name = process.env['ADMIN_SEED_NAME'] ?? 'Administrador Inicial';

  // Si las variables no estan definidas, terminar con exit(0) informativo
  if (!email || !password) {
    console.info(
      '[seed] ADMIN_SEED_EMAIL o ADMIN_SEED_PASSWORD no estan definidas. ' +
        'El seed no crea ningun administrador. ' +
        'Define estas variables de entorno para crear el admin inicial.',
    );
    process.exit(0);
  }

  // Validar requisitos de password
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    !PASSWORD_PATTERN.test(password)
  ) {
    console.error(
      '[seed] ERROR: ADMIN_SEED_PASSWORD no cumple los requisitos de seguridad. ' +
        `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres, incluyendo al menos una letra y un numero. ` +
        'La password NO se muestra en logs (Ley 1273/2009).',
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
  const prisma = new PrismaClient({ adapter });

  try {
    // Idempotencia: verificar si el admin ya existe
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (existing) {
      console.info(
        `[seed] El usuario con email '${email.toLowerCase()}' ya existe (id: ${existing.id}, rol: ${existing.role}). ` +
          'El seed es idempotente — no se crea un duplicado.',
      );
      process.exit(0);
    }

    // Hashear password (bcrypt 10 rondas, consistente con EPICA-01)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Valor placeholder para identificacion (obligatorio en el schema)
    // El admin puede actualizar estos datos despues del primer login
    const identificationNumber = `seed-admin-${Date.now()}`;

    // Crear User(ADMIN) + LegalAcceptances en una transaction atomica
    // Ley 1581/2012: registrar HABEAS_DATA y TERMS_OF_SERVICE (condicion bloqueante HU-001)
    // Ley 527/1999: registro inmutable con timestamp
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          role: UserRole.ADMIN,
          name,
          phone: '0000000000',
          phoneCountryCode: SEED_PHONE_COUNTRY_CODE,
          identificationType: SEED_IDENTIFICATION_TYPE,
          identificationNumber,
        },
      });

      // HABEAS_DATA — Ley 1581/2012, Decreto 1377/2013
      await tx.legalAcceptance.create({
        data: {
          userId: user.id,
          documentType: DocumentType.HABEAS_DATA,
          documentVersion: SEED_HABEAS_DATA_DOCUMENT_VERSION,
          ip: SEED_IP,
          userAgent: SEED_USER_AGENT,
        },
      });

      // TERMS_OF_SERVICE — Ley 527/1999
      await tx.legalAcceptance.create({
        data: {
          userId: user.id,
          documentType: DocumentType.TERMS_OF_SERVICE,
          documentVersion: SEED_TERMS_DOCUMENT_VERSION,
          ip: SEED_IP,
          userAgent: SEED_USER_AGENT,
        },
      });

      // Trazabilidad de auditoria (condicion no bloqueante HU-001)
      // Se loggea el id y timestamp — NUNCA la password (Ley 1273/2009)
      const timestamp = new Date().toISOString();
      console.info(
        `[seed] Administrador inicial creado exitosamente. ` +
          `id=${user.id} email=${user.email} timestamp=${timestamp}`,
      );
      console.info(
        '[seed] Aceptaciones legales registradas: HABEAS_DATA, TERMS_OF_SERVICE ' +
          `(Ley 1581/2012, Ley 527/1999). ip=${SEED_IP} userAgent=${SEED_USER_AGENT}`,
      );
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[seed] ERROR inesperado: ${message}`);
  process.exit(1);
});
