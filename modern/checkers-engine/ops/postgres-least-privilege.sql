-- Run as a database owner/DBA, not as the application role.
-- Replace gracz_database and passwords/role ownership to match the deployment.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gracz_app') THEN
    CREATE ROLE gracz_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END $$;

REVOKE ALL ON DATABASE gracz_database FROM PUBLIC;
GRANT CONNECT ON DATABASE gracz_database TO gracz_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO gracz_app;

-- Runtime permissions after migrations have been executed by a separate migration role.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gracz_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gracz_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gracz_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gracz_app;

-- Audit log is append/read only for the application. No UPDATE/DELETE.
REVOKE UPDATE, DELETE ON TABLE gracz_audit_log FROM gracz_app;
GRANT SELECT, INSERT ON TABLE gracz_audit_log TO gracz_app;

-- Recommended separate migration role (create/alter privileges) should be used only by CI/deploy migration jobs.
