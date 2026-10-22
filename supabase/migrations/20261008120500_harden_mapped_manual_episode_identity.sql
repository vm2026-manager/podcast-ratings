create or replace function public.protect_podcast_episode_identity()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  has_ratings boolean;
  has_manual_mapping boolean;
  override_enabled boolean := coalesce(current_setting('app.allow_episode_identity_migration', true), '') = 'on';
  destructive_change boolean;
begin
  select exists(select 1 from public.episode_ratings where episode_id = old.id)
    into has_ratings;
  select exists(
    select 1 from public.manual_catalogue_episode_map
    where episode_id = old.id and is_active = true
  ) into has_manual_mapping;

  if tg_op = 'DELETE' then
    if (has_ratings or has_manual_mapping) and not override_enabled then
      raise exception 'Protected episode % cannot be deleted while ratings or an active manual catalogue mapping exist', old.id;
    end if;

    insert into public.episode_identity_audit(episode_id,action,old_identity,reason)
    values (
      old.id,
      'episode_deleted',
      jsonb_build_object(
        'podcast_key', old.podcast_key,
        'source', old.source,
        'external_guid', old.external_guid,
        'external_episode_id', old.external_episode_id,
        'is_active', old.is_active,
        'rateable', coalesce(old.metadata->>'rateable','true'),
        'title', old.title
      ),
      case when override_enabled then 'explicit_identity_migration_override' else null end
    );
    return old;
  end if;

  destructive_change :=
       new.id is distinct from old.id
    or new.podcast_key is distinct from old.podcast_key
    or new.source is distinct from old.source
    or new.external_guid is distinct from old.external_guid
    or new.external_episode_id is distinct from old.external_episode_id
    or (old.is_active = true and new.is_active = false)
    or (
      coalesce(old.metadata->>'rateable','true') = 'true'
      and coalesce(new.metadata->>'rateable','true') = 'false'
    );

  if destructive_change and (has_ratings or has_manual_mapping) and not override_enabled then
    raise exception 'Protected episode % identity/visibility cannot change while ratings or an active manual catalogue mapping exist', old.id;
  end if;

  if new.podcast_key is distinct from old.podcast_key
     or new.source is distinct from old.source
     or new.external_guid is distinct from old.external_guid
     or new.external_episode_id is distinct from old.external_episode_id
     or new.is_active is distinct from old.is_active then
    insert into public.episode_identity_audit(episode_id,action,old_identity,new_identity,reason)
    values (
      old.id,
      'episode_identity_updated',
      jsonb_build_object(
        'podcast_key', old.podcast_key,
        'source', old.source,
        'external_guid', old.external_guid,
        'external_episode_id', old.external_episode_id,
        'is_active', old.is_active,
        'rateable', coalesce(old.metadata->>'rateable','true')
      ),
      jsonb_build_object(
        'podcast_key', new.podcast_key,
        'source', new.source,
        'external_guid', new.external_guid,
        'external_episode_id', new.external_episode_id,
        'is_active', new.is_active,
        'rateable', coalesce(new.metadata->>'rateable','true')
      ),
      case when override_enabled then 'explicit_identity_migration_override' else 'allowed_non_destructive_identity_update' end
    );
  end if;

  return new;
end
$$;
