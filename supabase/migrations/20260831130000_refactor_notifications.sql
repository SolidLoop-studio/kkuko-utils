alter table public.notification
  add column views bigint not null default 0,
  add constraint notification_views_nonnegative check (views >= 0);

create or replace function public.increment_notification_views(p_notification_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_views bigint;
begin
  if p_notification_id is null or p_notification_id <= 0 then
    return null;
  end if;

  update public.notification
     set views = views + 1
   where id = p_notification_id
   returning views into v_views;

  return v_views;
end;
$$;

revoke all on function public.increment_notification_views(bigint) from public;
grant execute on function public.increment_notification_views(bigint) to anon, authenticated, service_role;
