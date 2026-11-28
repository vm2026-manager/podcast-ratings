begin;

set local lock_timeout = '5s';

create function public.protect_det_vi_taler_om_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Archived Det, vi taler om episode % cannot be deleted', old.id
      using errcode = '23514';
  end if;

  if new.id is distinct from old.id
     or new.podcast_key is distinct from old.podcast_key
     or new.source is distinct from old.source
     or new.external_guid is distinct from old.external_guid
     or new.external_episode_id is distinct from old.external_episode_id
     or (old.is_active is true and new.is_active is not true)
     or (old.metadata->'rateable' is distinct from 'false'::jsonb
         and new.metadata->'rateable' = 'false'::jsonb) then
    raise exception 'Archived Det, vi taler om episode % cannot change identity or lose visibility', old.id
      using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all on function public.protect_det_vi_taler_om_archive() from public;

create trigger podcast_episodes_protect_det_vi_taler_om_archive
before update or delete on public.podcast_episodes
for each row
when (old.podcast_key = 'det vi taler om' and old.source = 'radio4_det_vi_taler_om_rss')
execute function public.protect_det_vi_taler_om_archive();

commit;
