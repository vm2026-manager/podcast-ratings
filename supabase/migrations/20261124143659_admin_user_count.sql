-- Keep the privileged Auth-table read outside the API-exposed schemas.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.admin_user_count()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'aspmads@hotmail.com' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  return (select count(*) from auth.users);
end;
$$;

revoke all on function private.admin_user_count() from public, anon, authenticated;
grant execute on function private.admin_user_count() to authenticated;

-- PostgREST can call this SECURITY INVOKER wrapper in the exposed public
-- schema; the private function performs the authorization check and count.
create or replace function public.admin_user_count()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.admin_user_count();
$$;

revoke all on function public.admin_user_count() from public, anon;
grant execute on function public.admin_user_count() to authenticated;
