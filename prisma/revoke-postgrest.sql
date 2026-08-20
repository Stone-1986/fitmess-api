-- ============================================================================
-- Bloqueo de acceso PostgREST a las tablas de dominio
-- ============================================================================
--
-- Lo ejecuta el DESARROLLADOR HUMANO en el SQL Editor de Supabase.
-- No lo corre Prisma ni ningun agente: no es una migracion, es configuracion
-- de permisos del proyecto de Supabase.
--
-- POR QUE
-- `rulesArquitectura.md § Acceso a Supabase` establece que el frontend y el
-- mobile NUNCA llaman a la API de PostgREST: toda interaccion con datos ocurre
-- a traves de la API de NestJS (/api/...). Supabase expone automaticamente por
-- PostgREST cualquier tabla del esquema `public` a la que los roles `anon` y
-- `authenticated` tengan permisos. Sin este REVOKE, un cliente con la anon key
-- puede leer y escribir las tablas directamente, saltandose los guards, la
-- validacion de DTOs, las reglas de negocio y el rastro de auditoria.
--
-- CUANDO
-- La seccion 1 (ALTER DEFAULT PRIVILEGES) se ejecuta UNA sola vez.
-- La seccion 2 se ejecuta ahora y despues de cada `pnpm prisma migrate dev`
-- que agregue tablas, MIENTRAS la seccion 1 no este aplicada.
--
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Permanente — cubre las tablas FUTURAS
-- ----------------------------------------------------------------------------
--
-- Un REVOKE normal solo afecta a las tablas que existen en el momento de
-- ejecutarlo. Cada migracion nueva crea tablas que nacen con los permisos por
-- defecto, y hay que acordarse de volver a revocar. Esto lo resuelve de raiz.
--
-- ADVERTENCIA: ALTER DEFAULT PRIVILEGES aplica a las tablas que cree EL ROL
-- con el que estas conectado al ejecutarlo. Si Prisma migra con un rol distinto
-- del que usas en el SQL Editor, esto NO surte efecto — en ese caso usa:
--   ALTER DEFAULT PRIVILEGES FOR ROLE <rol_de_prisma> IN SCHEMA public ...
-- Para saber con que rol migra Prisma, mira el usuario de DATABASE_URL en .env

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. Barrido — cubre las tablas que YA existen
-- ----------------------------------------------------------------------------
--
-- ADVERTENCIA: alcanza todo el esquema `public`. En este proyecto ahi solo
-- viven las tablas de dominio que crea Prisma, asi que es seguro. Si algun dia
-- Supabase coloca en `public` una tabla que sus propios servicios necesiten
-- leer por PostgREST, este barrido la bloquearia — revisa la lista antes.

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2b. Alternativa acotada, tabla por tabla
-- ----------------------------------------------------------------------------
--
-- Si prefieres no usar el barrido de la seccion 2, este es el equivalente
-- explicito para las tablas existentes a la fecha. Hay que ampliarlo con cada
-- epica nueva — que es justo el problema que evita la seccion 1.
--
-- No se revocan secuencias: todos los modelos usan @default(uuid()), no hay
-- columnas `serial` ni secuencias asociadas.
--
-- EPICA-01 + EPICA-09 (auth y cumplimiento legal):
--   REVOKE ALL PRIVILEGES ON TABLE
--     public.users,
--     public.coach_requests,
--     public.legal_acceptances,
--     public.audit_logs,
--     public.refresh_tokens,
--     public.admin_invitations
--   FROM anon, authenticated;
--
-- EPICA-02 (catalogo de ejercicios):
--   REVOKE ALL PRIVILEGES ON TABLE
--     public.exercises,
--     public.exercise_versions
--   FROM anon, authenticated;
--
-- EPICA-03 (planes de entrenamiento):
--   REVOKE ALL PRIVILEGES ON TABLE
--     public.plans,
--     public.phases,
--     public.weeks,
--     public.sessions,
--     public.session_exercises
--   FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. Verificacion — debe devolver CERO filas
-- ----------------------------------------------------------------------------
--
-- Si devuelve alguna fila, esa tabla sigue expuesta por PostgREST.

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
