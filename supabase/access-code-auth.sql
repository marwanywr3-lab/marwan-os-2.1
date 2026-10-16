create table public.access_code_credentials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 code_hash text unique not null check (code_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
create table public.access_code_limits (
 bucket_key text primary key,
 window_start timestamptz not null,
 attempts integer not null check (attempts > 0)
);
alter table public.access_code_credentials enable row level security;
alter table public.access_code_limits enable row level security;
revoke all on public.access_code_credentials, public.access_code_limits from public, anon, authenticated;
grant all on public.access_code_credentials, public.access_code_limits to service_role;
create function public.consume_access_code_limit(p_key text, p_window integer, p_max integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 if p_window < 1 or p_max < 1 or length(p_key)>100 then return false; end if;
 insert into public.access_code_limits as lim(bucket_key,window_start,attempts)
 values(p_key,now(),1)
 on conflict(bucket_key) do update set
 attempts = case when lim.window_start < now()-make_interval(secs=>p_window) then 1 else lim.attempts+1 end,
 window_start = case when lim.window_start < now()-make_interval(secs=>p_window) then now() else lim.window_start end
 returning attempts into n;
 delete from public.access_code_limits where window_start < now()-interval '2 days';
 return n<=p_max;
end $$;
revoke all on function public.consume_access_code_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_access_code_limit(text,integer,integer) to service_role;
