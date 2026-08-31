begin;
select plan(8);

create temporary table notification_view_fixture as
with inserted as (
  insert into public.notification (title, body, end_at)
  values ('조회수 테스트', '본문', now() + interval '1 day')
  returning id
)
select id from inserted;

select is(
  (select views from public.notification where id = (select id from notification_view_fixture)),
  0::bigint,
  'new notifications start at zero views'
);
select is(
  public.increment_notification_views((select id from notification_view_fixture)),
  1::bigint,
  'first view returns one'
);
select is(
  public.increment_notification_views((select id from notification_view_fixture)),
  2::bigint,
  'second view returns two'
);
select is(
  (select views from public.notification where id = (select id from notification_view_fixture)),
  2::bigint,
  'increments are persisted without lost updates'
);
select is(public.increment_notification_views(9223372036854775807), null::bigint, 'missing notice returns null');
select throws_ok(
  $$update public.notification
       set views = -1
     where id = (select id from notification_view_fixture)$$,
  '23514',
  null,
  'negative views are rejected'
);
select ok(has_function_privilege('anon', 'public.increment_notification_views(bigint)', 'EXECUTE'), 'anon can record views');
select ok(has_function_privilege('authenticated', 'public.increment_notification_views(bigint)', 'EXECUTE'), 'authenticated can record views');

select * from finish();
rollback;
