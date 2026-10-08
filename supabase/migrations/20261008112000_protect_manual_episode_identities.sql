begin;

create table if not exists public.episode_identity_audit (
  id bigint generated always as identity primary key,
  episode_id uuid,
  action text not null,
  old_identity jsonb,
  new_identity jsonb,
  reason text,
  actor_role text not null default current_user,
  created_at timestamptz not null default now()
);

alter table public.episode_identity_audit enable row level security;
revoke all on public.episode_identity_audit from anon, authenticated;

create or replace function public.episode_identity_fingerprint(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  with normalized as (
    select lower(
      regexp_replace(
        regexp_replace(trim(coalesce(value, '')), '^teaser:\s*', '', 'i'),
        '\s+', ' ', 'g'
      )
    ) as title
  )
  select coalesce(
    nullif(substring(title from '([0-9]+:[0-9]+\s*-\s*.+)$'), ''),
    title
  )
  from normalized
$$;

create or replace function public.ensure_manual_catalogue_episode(
  p_podcast_key text,
  p_manual_episode_key text,
  p_episode_id uuid,
  p_title text,
  p_legacy_episode_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  existing_mapping public.manual_catalogue_episode_map%rowtype;
  candidate_ids uuid[];
  canonical_id uuid;
  legacy_ids text[] := '{}'::text[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  p_podcast_key := trim(coalesce(p_podcast_key, ''));
  p_manual_episode_key := trim(coalesce(p_manual_episode_key, ''));
  p_title := trim(coalesce(p_title, ''));

  if p_podcast_key = '' or p_manual_episode_key = '' or p_title = '' or p_episode_id is null then
    raise exception 'Invalid manual episode identity';
  end if;

  if p_manual_episode_key like 'manual-catalogue-v1:%' then
    if p_manual_episode_key <> 'manual-catalogue-v1:' || p_episode_id::text then
      raise exception 'Manual v1 key does not match episode UUID';
    end if;
  elsif p_manual_episode_key like 'manual-catalogue-v2:%' then
    if p_manual_episode_key not like 'manual-catalogue-v2:' || p_podcast_key || ':%' then
      raise exception 'Manual v2 key does not match podcast identity';
    end if;
  else
    raise exception 'Unsupported manual episode key';
  end if;

  select *
  into existing_mapping
  from public.manual_catalogue_episode_map
  where manual_episode_key = p_manual_episode_key
  for update;

  if found then
    if existing_mapping.podcast_key is distinct from p_podcast_key
       or existing_mapping.is_active is not true then
      raise exception 'Existing manual episode mapping conflicts with requested identity';
    end if;
    return existing_mapping.episode_id;
  end if;

  select array_agg(id order by id)
  into candidate_ids
  from public.podcast_episodes
  where podcast_key = p_podcast_key
    and is_active = true
    and public.episode_identity_fingerprint(title) = public.episode_identity_fingerprint(p_title);

  if coalesce(array_length(candidate_ids, 1), 0) > 1 then
    raise exception 'Ambiguous existing episode identity; manual episode was not linked';
  end if;

  canonical_id := case
    when coalesce(array_length(candidate_ids, 1), 0) = 1 then candidate_ids[1]
    else p_episode_id
  end;

  if canonical_id = p_episode_id then
    if exists (
      select 1
      from public.podcast_episodes
      where id = p_episode_id
        and (
          podcast_key is distinct from p_podcast_key
          or source is distinct from 'manual_catalogue_v1'
          or external_guid is distinct from 'manual_catalogue_v1:' || p_episode_id::text
        )
    ) then
      raise exception 'Manual episode UUID already belongs to another identity';
    end if;

    insert into public.podcast_episodes (
      id, podcast_key, source, external_guid, external_episode_id, title, is_active, metadata
    )
    values (
      p_episode_id,
      p_podcast_key,
      'manual_catalogue_v1',
      'manual_catalogue_v1:' || p_episode_id::text,
      p_manual_episode_key,
      p_title,
      true,
      jsonb_build_object(
        'manual_catalogue', true,
        'manual_episode_key', p_manual_episode_key,
        'identity_version', 'manual_catalogue_v1',
        'rateable', true
      )
    )
    on conflict (source, external_guid) do nothing;
  end if;

  if canonical_id <> p_episode_id then
    legacy_ids := array_append(legacy_ids, p_episode_id::text);
  end if;
  if nullif(trim(coalesce(p_legacy_episode_id, '')), '') is not null
     and not (trim(p_legacy_episode_id) = any(legacy_ids)) then
    legacy_ids := array_append(legacy_ids, trim(p_legacy_episode_id));
  end if;

  insert into public.manual_catalogue_episode_map (
    manual_episode_key, podcast_key, episode_id, canonical_source, legacy_episode_ids, title, is_active
  )
  values (
    p_manual_episode_key,
    p_podcast_key,
    canonical_id,
    'manual_catalogue_v1',
    legacy_ids,
    p_title,
    true
  );

  insert into public.episode_identity_audit (episode_id, action, new_identity, reason)
  values (
    canonical_id,
    'manual_episode_canonicalized',
    jsonb_build_object(
      'manual_episode_key', p_manual_episode_key,
      'podcast_key', p_podcast_key,
      'episode_id', canonical_id,
      'submitted_episode_id', p_episode_id,
      'title', p_title
    ),
    case when canonical_id = p_episode_id
      then 'created_manual_canonical_identity'
      else 'linked_manual_catalogue_to_existing_episode'
    end
  );

  return canonical_id;
end
$$;

revoke all on function public.ensure_manual_catalogue_episode(text,text,uuid,text,text) from public, anon;
grant execute on function public.ensure_manual_catalogue_episode(text,text,uuid,text,text) to authenticated;

create or replace function public.protect_podcast_episode_identity()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  has_ratings boolean;
  override_enabled boolean := coalesce(current_setting('app.allow_episode_identity_migration', true), '') = 'on';
begin
  select exists(select 1 from public.episode_ratings where episode_id = old.id) into has_ratings;

  if tg_op = 'DELETE' then
    if has_ratings and not override_enabled then
      raise exception 'Rated episode % cannot be deleted without explicit identity migration override', old.id;
    end if;
    if old.source in ('manual_catalogue_v1', 'manual_catalogue_reviewed_legacy') and not override_enabled then
      raise exception 'Manual catalogue episode % cannot be deleted without explicit identity migration override', old.id;
    end if;

    insert into public.episode_identity_audit(episode_id,action,old_identity,reason)
    values (
      old.id,
      'episode_deleted',
      jsonb_build_object(
        'podcast_key', old.podcast_key,
        'source', old.source,
        'external_guid', old.external_guid,
        'is_active', old.is_active,
        'title', old.title
      ),
      case when override_enabled then 'explicit_identity_migration_override' else null end
    );
    return old;
  end if;

  if has_ratings and not override_enabled and (
    new.id is distinct from old.id
    or new.podcast_key is distinct from old.podcast_key
    or new.source is distinct from old.source
    or new.external_guid is distinct from old.external_guid
    or (old.is_active = true and new.is_active = false)
    or (coalesce((old.metadata->>'rateable')::boolean, true) = true and coalesce((new.metadata->>'rateable')::boolean, true) = false)
  ) then
    raise exception 'Rated episode % identity/visibility is protected', old.id;
  end if;

  if old.source in ('manual_catalogue_v1', 'manual_catalogue_reviewed_legacy')
     and not override_enabled
     and (
       new.id is distinct from old.id
       or new.podcast_key is distinct from old.podcast_key
       or new.source is distinct from old.source
       or new.external_guid is distinct from old.external_guid
       or (old.is_active = true and new.is_active = false)
       or (coalesce((old.metadata->>'rateable')::boolean, true) = true and coalesce((new.metadata->>'rateable')::boolean, true) = false)
     ) then
    raise exception 'Manual catalogue episode % identity/visibility is protected', old.id;
  end if;

  if new.podcast_key is distinct from old.podcast_key
     or new.source is distinct from old.source
     or new.external_guid is distinct from old.external_guid
     or new.is_active is distinct from old.is_active then
    insert into public.episode_identity_audit(episode_id,action,old_identity,new_identity,reason)
    values (
      old.id,
      'episode_identity_updated',
      jsonb_build_object(
        'podcast_key', old.podcast_key,
        'source', old.source,
        'external_guid', old.external_guid,
        'is_active', old.is_active
      ),
      jsonb_build_object(
        'podcast_key', new.podcast_key,
        'source', new.source,
        'external_guid', new.external_guid,
        'is_active', new.is_active
      ),
      case when override_enabled then 'explicit_identity_migration_override' else 'allowed_non_destructive_identity_update' end
    );
  end if;

  return new;
end
$$;

drop trigger if exists trg_protect_episode_identity_and_ratings on public.podcast_episodes;
drop trigger if exists podcast_episodes_protect_identity on public.podcast_episodes;
create trigger podcast_episodes_protect_identity
before update or delete on public.podcast_episodes
for each row execute function public.protect_podcast_episode_identity();

create or replace function public.protect_manual_catalogue_episode_map()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  has_ratings boolean;
  override_enabled boolean := coalesce(current_setting('app.allow_episode_identity_migration', true), '') = 'on';
begin
  select exists(select 1 from public.episode_ratings where episode_id = old.episode_id) into has_ratings;

  if tg_op = 'DELETE' then
    if (has_ratings or old.is_active) and not override_enabled then
      raise exception 'Active/rated manual catalogue mapping % is protected', old.manual_episode_key;
    end if;
    return old;
  end if;

  if not override_enabled and (
    new.manual_episode_key is distinct from old.manual_episode_key
    or new.podcast_key is distinct from old.podcast_key
    or new.episode_id is distinct from old.episode_id
    or new.canonical_source is distinct from old.canonical_source
    or (old.is_active = true and new.is_active = false)
  ) then
    raise exception 'Manual catalogue mapping % identity is protected', old.manual_episode_key;
  end if;

  return new;
end
$$;

drop trigger if exists manual_catalogue_episode_map_protect_identity on public.manual_catalogue_episode_map;
create trigger manual_catalogue_episode_map_protect_identity
before update or delete on public.manual_catalogue_episode_map
for each row execute function public.protect_manual_catalogue_episode_map();

insert into public.podcast_episodes (
  id, podcast_key, source, external_guid, external_episode_id, title, is_active, metadata
)
values
  ('d55b995c-f6d5-58cb-a811-94921a5ccc61', 'danmarks vaerste massemorder', 'manual_catalogue_v1',
   'manual_catalogue_v1:d55b995c-f6d5-58cb-a811-94921a5ccc61', 'manual-catalogue-v1:d55b995c-f6d5-58cb-a811-94921a5ccc61',
   '1:5 - Hotel i flammer', true,
   '{"manual_catalogue":true,"identity_version":"manual_catalogue_v1","rateable":true}'::jsonb),
  ('8a52fae6-47a2-5c7d-a710-a8a8addbbba7', 'danmarks vaerste massemorder', 'manual_catalogue_v1',
   'manual_catalogue_v1:8a52fae6-47a2-5c7d-a710-a8a8addbbba7', 'manual-catalogue-v1:8a52fae6-47a2-5c7d-a710-a8a8addbbba7',
   '2:5 - Pyromanen', true,
   '{"manual_catalogue":true,"identity_version":"manual_catalogue_v1","rateable":true}'::jsonb),
  ('cc9731a8-cc12-5809-8a8e-2b4aac8ece7b', 'danmarks vaerste massemorder', 'manual_catalogue_v1',
   'manual_catalogue_v1:cc9731a8-cc12-5809-8a8e-2b4aac8ece7b', 'manual-catalogue-v1:cc9731a8-cc12-5809-8a8e-2b4aac8ece7b',
   '3:5 - Opdigtede brande', true,
   '{"manual_catalogue":true,"identity_version":"manual_catalogue_v1","rateable":true}'::jsonb),
  ('5843277d-8a1c-59b2-9f3e-e0e78234d88c', 'danmarks vaerste massemorder', 'manual_catalogue_v1',
   'manual_catalogue_v1:5843277d-8a1c-59b2-9f3e-e0e78234d88c', 'manual-catalogue-v1:5843277d-8a1c-59b2-9f3e-e0e78234d88c',
   '5:5 -', true,
   '{"manual_catalogue":true,"identity_version":"manual_catalogue_v1","rateable":true}'::jsonb)
on conflict (source, external_guid) do nothing;

insert into public.manual_catalogue_episode_map (
  manual_episode_key, podcast_key, episode_id, canonical_source, legacy_episode_ids, title, is_active
)
values
  ('manual-catalogue-v1:d55b995c-f6d5-58cb-a811-94921a5ccc61', 'danmarks vaerste massemorder',
   'd55b995c-f6d5-58cb-a811-94921a5ccc61', 'manual_catalogue_v1', '{}'::text[], '1:5 - Hotel i flammer', true),
  ('manual-catalogue-v1:8a52fae6-47a2-5c7d-a710-a8a8addbbba7', 'danmarks vaerste massemorder',
   '8a52fae6-47a2-5c7d-a710-a8a8addbbba7', 'manual_catalogue_v1', '{}'::text[], '2:5 - Pyromanen', true),
  ('manual-catalogue-v1:cc9731a8-cc12-5809-8a8e-2b4aac8ece7b', 'danmarks vaerste massemorder',
   'cc9731a8-cc12-5809-8a8e-2b4aac8ece7b', 'manual_catalogue_v1', '{}'::text[], '3:5 - Opdigtede brande', true),
  ('manual-catalogue-v1:5843277d-8a1c-59b2-9f3e-e0e78234d88c', 'danmarks vaerste massemorder',
   '5843277d-8a1c-59b2-9f3e-e0e78234d88c', 'manual_catalogue_v1', '{}'::text[], '5:5 -', true)
on conflict (manual_episode_key) do nothing;

do $$
declare
  candidates uuid[];
  canonical_id uuid;
begin
  if not exists (
    select 1 from public.manual_catalogue_episode_map
    where manual_episode_key = 'manual-catalogue-v1:76c02b6e-4d22-5055-9a09-bcd4ba14867b'
  ) then
    select array_agg(id order by id)
    into candidates
    from public.podcast_episodes
    where podcast_key = 'danmarks vaerste massemorder'
      and is_active = true
      and public.episode_identity_fingerprint(title) = public.episode_identity_fingerprint('4:5 - Tragedien på Fanø');

    if coalesce(array_length(candidates, 1), 0) > 1 then
      raise exception 'Ambiguous canonical identity for Danmarks værste massemorder 4:5';
    end if;

    canonical_id := case
      when coalesce(array_length(candidates, 1), 0) = 1 then candidates[1]
      else '76c02b6e-4d22-5055-9a09-bcd4ba14867b'::uuid
    end;

    if canonical_id = '76c02b6e-4d22-5055-9a09-bcd4ba14867b'::uuid then
      insert into public.podcast_episodes (
        id, podcast_key, source, external_guid, external_episode_id, title, is_active, metadata
      ) values (
        canonical_id, 'danmarks vaerste massemorder', 'manual_catalogue_v1',
        'manual_catalogue_v1:76c02b6e-4d22-5055-9a09-bcd4ba14867b',
        'manual-catalogue-v1:76c02b6e-4d22-5055-9a09-bcd4ba14867b',
        '4:5 - Tragedien på Fanø', true,
        '{"manual_catalogue":true,"identity_version":"manual_catalogue_v1","rateable":true}'::jsonb
      ) on conflict (source, external_guid) do nothing;
    end if;

    insert into public.manual_catalogue_episode_map (
      manual_episode_key, podcast_key, episode_id, canonical_source, legacy_episode_ids, title, is_active
    ) values (
      'manual-catalogue-v1:76c02b6e-4d22-5055-9a09-bcd4ba14867b',
      'danmarks vaerste massemorder', canonical_id, 'manual_catalogue_v1',
      case when canonical_id = '76c02b6e-4d22-5055-9a09-bcd4ba14867b'::uuid
        then '{}'::text[] else array['76c02b6e-4d22-5055-9a09-bcd4ba14867b']::text[] end,
      '4:5 - Tragedien på Fanø', true
    );
  end if;
end $$;

commit;
