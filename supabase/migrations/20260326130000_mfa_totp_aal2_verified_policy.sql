-- Enforce MFA assurance level in the database.
-- If the user has at least one verified MFA factor, require `aal2` for all access.
-- This prevents users from using an `aal1` session to access protected data.

DO $$
DECLARE
  r RECORD;
  policy_name text := 'mfa_verified_requires_aal2';
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    -- Only attempt tables that have RLS enabled.
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = r.schemaname
        AND c.relname = r.tablename
        AND c.relrowsecurity
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = r.schemaname
          AND tablename = r.tablename
          AND policyname = policy_name
      ) THEN
        EXECUTE format($fmt$
          CREATE POLICY %I ON %I.%I
          AS RESTRICTIVE
          FOR ALL
          TO authenticated
          USING (
            (auth.jwt()->>'aal') = 'aal2'
            OR NOT EXISTS (
              SELECT 1
              FROM auth.mfa_factors
              WHERE user_id = auth.uid()
                AND status = 'verified'
            )
          )
          WITH CHECK (
            (auth.jwt()->>'aal') = 'aal2'
            OR NOT EXISTS (
              SELECT 1
              FROM auth.mfa_factors
              WHERE user_id = auth.uid()
                AND status = 'verified'
            )
          );
        $fmt$, policy_name, r.schemaname, r.tablename);
      END IF;
    END IF;
  END LOOP;
END $$;

