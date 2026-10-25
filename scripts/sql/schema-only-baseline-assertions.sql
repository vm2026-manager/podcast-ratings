DO $$
DECLARE
  expected_tables text[] := ARRAY[
    'episode_identity_audit', 'episode_identity_history', 'episode_import_runs',
    'episode_ratings', 'manual_catalogue_episode_map', 'podcast_episodes',
    'podcast_ranking_rating_snapshots', 'podcast_suggestions', 'saved_podcasts',
    'user_ratings'
  ];
  table_name text;
  remaining_tables integer;
  privilege_name text;
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'Supabase Auth platform schema is not available';
  END IF;

  FOREACH table_name IN ARRAY expected_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Baseline table public.% is missing', table_name;
    END IF;
  END LOOP;
  IF to_regclass('private.display_group_rating_members') IS NULL THEN
    RAISE EXCEPTION 'Baseline private.display_group_rating_members is missing';
  END IF;

  SELECT count(*) INTO remaining_tables
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name = ANY(expected_tables);
  IF remaining_tables <> cardinality(expected_tables) THEN
    RAISE EXCEPTION 'Expected % public app tables; found %', cardinality(expected_tables), remaining_tables;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.episode_ratings'::regclass
      AND conname = 'episode_ratings_episode_id_fkey'
      AND confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'Current episode-rating FK must be RESTRICT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.manual_catalogue_episode_map'::regclass
      AND conname = 'manual_catalogue_episode_map_episode_id_key'
      AND contype = 'u'
  ) THEN
    RAISE EXCEPTION 'Manual map must retain the unique episode UUID constraint';
  END IF;
  IF (SELECT count(*) FROM pg_default_acl d JOIN pg_roles r ON r.oid = d.defaclrole
      JOIN pg_namespace n ON n.oid = d.defaclnamespace
      WHERE r.rolname = 'supabase_admin' AND n.nspname = 'public') <> 3 THEN
    RAISE EXCEPTION 'Expected all three production default ACL categories for supabase_admin';
  END IF;

  IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal) <> 6 THEN
    RAISE EXCEPTION 'Expected all six production application triggers';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','private')) <> 17 THEN
    RAISE EXCEPTION 'Expected all 17 production application policies';
  END IF;

  IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 2
     OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261024000000')
     OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261025000000') THEN
    RAISE EXCEPTION 'Expected only the local test-role setup and schema-only bootstrap migrations';
  END IF;

  IF (SELECT relrowsecurity FROM pg_class WHERE oid='public.episode_identity_history'::regclass) THEN
    RAISE EXCEPTION 'Baseline must match current production RLS state; PR #335 remains separate';
  END IF;
  FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege('anon','public.episode_identity_history',privilege_name)
       OR has_table_privilege('authenticated','public.episode_identity_history',privilege_name) THEN
      RAISE EXCEPTION 'Episode identity history grants % to a client role', privilege_name;
    END IF;
  END LOOP;
  FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF NOT has_table_privilege('service_role','public.episode_identity_history',privilege_name) THEN
      RAISE EXCEPTION 'service_role table ACL is missing %', privilege_name;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.episode_ratings)
     OR EXISTS (SELECT 1 FROM public.podcast_episodes)
     OR EXISTS (SELECT 1 FROM public.manual_catalogue_episode_map)
     OR EXISTS (SELECT 1 FROM public.episode_identity_history) THEN
    RAISE EXCEPTION 'Schema-only baseline unexpectedly contains episode, rating, mapping, or history rows';
  END IF;

  IF to_regclass('cron.job') IS NOT NULL AND EXISTS (SELECT 1 FROM cron.job) THEN
    RAISE EXCEPTION 'Schema-only baseline unexpectedly created cron jobs';
  END IF;
END
$$;

SELECT 'Schema-only Supabase baseline assertions: PASS' AS result;
