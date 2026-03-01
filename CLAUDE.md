# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**fitmess-api** is a NestJS 11 backend API for a fitness platform. TypeScript, Prisma ORM with PostgreSQL, pnpm. Domain language (error messages, comments, catalog entries) is in **Spanish**.

---

## Common Commands

```bash
pnpm install                  # Install dependencies
pnpm run build                # Compile (nest build, output to dist/)
pnpm run start:dev            # Dev server with watch mode
pnpm run start:debug          # Debug mode with watch
pnpm run start:prod           # Production (node dist/main)
pnpm run lint                 # ESLint with auto-fix
pnpm run format               # Prettier formatting
pnpm run test                 # Unit tests (Vitest)
pnpm run test:watch           # Unit tests in watch mode
pnpm run test:cov             # Unit tests with coverage report (gate duro)
pnpm run test:e2e             # E2E tests (supertest, vitest.config.e2e.ts)
pnpm run test -- --testPathPattern=<pattern>  # Run a single test file
pnpm run openapi:validate     # Export + validate OpenAPI contract with Spectral
pnpm run validate:epica <file>  # Validate épica YAML structure before Agent Team
pnpm prisma generate          # Regenerate Prisma client after schema changes
pnpm prisma migrate dev       # Create and apply migrations
```

---

## Architecture

- **Framework:** NestJS 11 with Express platform, module-based architecture
- **Language:** TypeScript · `nodenext` module resolution · ES2023 target · strict null checks
- **Database:** PostgreSQL via Prisma ORM with `@prisma/adapter-pg` for connection pooling
  - Schema: `prisma/schema.prisma`
  - Config: `prisma.config.ts`
  - Generated client: `generated/prisma/` (gitignored) — ver rules para convenciones de import
  - Database URL from `DATABASE_URL` env var
- **Auth:** Passport with JWT and local strategies, bcrypt for password hashing
- **Validation:** class-validator and class-transformer for DTO validation
- **API Docs:** @nestjs/swagger
- **Logging:** nestjs-pino / pino-http (pino-pretty in dev)
- **Config:** @nestjs/config with dotenv (.env files are gitignored)
- **Error Tracking:** Sentry (@sentry/nestjs)
- **Rate Limiting:** @nestjs/throttler
- **Health Checks:** @nestjs/terminus
- **Events:** @nestjs/event-emitter
- **Email:** Resend
- **AI:** Anthropic SDK (@anthropic-ai/sdk)
- **Security:** Helmet for HTTP headers

---

## Project Rules

Absolute rules that apply in every session. Read before any implementation work:

- [Rules — Código](.claude/rules/rulesCodigo.md): Exceptions, data access, controllers, responses, language conventions
- [Rules — Arquitectura](.claude/rules/rulesArquitectura.md): Module structure, prohibited patterns, API, security, testing, git

---

## Code Style

- ESLint flat config (`eslint.config.mjs`) with typescript-eslint type-checked rules and Prettier integration
- Prettier: single quotes, trailing commas on all
- `no-explicit-any` and `no-unsafe-argument` are relaxed (off/warn); `no-floating-promises` is warn

---

## Available Skills

Load the relevant skill when working on specialized tasks. Skills provide detailed conventions, patterns, and examples beyond what is in this file.

| Skill | When to load | Status |
|---|---|---|
| `nestjs-conventions` | Creating or modifying modules, controllers, services, DTOs, response envelope | Active |
| `error-handling` | Implementing or reviewing error handling, exceptions, filters | Active |
| `testing-patterns` | Writing or reviewing unit tests, e2e tests, coverage validation | Active |
| `design-patterns` | Implementing state machines, events, soft-delete, audit trail, versioning | Active |
| `api-first` | Designing or documenting endpoints, OpenAPI contract, Swagger decorators | Active |
| `legal-guardrails` | Any feature involving user data, authentication, transactions, or legal compliance | Active |
| `planificar-epica` | Orchestrating Phase 1: Agent Team (Analyst + Architect → Documentor → DBA → CHECKPOINT 1) | Active |
| `implementar-epica` | Orchestrating Phase 2: Implementation chain (Developer → QA → Tech Lead, max 3 cycles) | Active |
| `disenar-schema` | Standalone DBA invocation for Prisma schema design outside the planning flow | Active |

---

## Module Structure

```
src/modules/
  auth/           → EPICA-01
  exercises/      → EPICA-02
  plans/          → EPICA-03
  subscriptions/  → EPICA-04
  execution/      → EPICA-05 + 06
  metrics/        → EPICA-07
  ai/             → EPICA-08
  notifications/  → Transversal
  prisma/         → Transversal
  common/         → Transversal (guards, interceptors, pipes, decorators, exceptions, logging)
```

> For detailed conventions on module internals, DTOs, and controller patterns → load skill `nestjs-conventions`
> For error handling patterns → load skill `error-handling`
> For testing conventions → load skill `testing-patterns`