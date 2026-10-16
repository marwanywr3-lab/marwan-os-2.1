create table public.ai_provider_credentials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 provider text not null check(provider in ('claude','gemini')),
 secret_id uuid not null unique references vault.secrets(id),
 model_map jsonb not null default '{}',
 key_hint text not null,
 checked_at timestamptz not null default now()
);
alter table public.ai_provider_credentials enable row level security;
revoke all on public.ai_provider_credentials from public,anon,authenticated;
grant all on public.ai_provider_credentials to service_role;
create function marwan_private.cleanup_ai_provider_secret() returns trigger
language plpgsql security definer set search_path='' as $$
begin delete from vault.secrets where id=old.secret_id; return old; end $$;
revoke all on function marwan_private.cleanup_ai_provider_secret() from public,anon,authenticated;
create trigger cleanup_ai_provider_secret after delete on public.ai_provider_credentials
for each row execute function marwan_private.cleanup_ai_provider_secret();
create function public.read_ai_provider_key(p_user uuid)
returns table(provider text,api_key text,model_map jsonb,key_hint text)
language sql security invoker set search_path='' as $$
 select c.provider,s.decrypted_secret,c.model_map,c.key_hint
 from public.ai_provider_credentials c join vault.decrypted_secrets s on s.id=c.secret_id where c.user_id=p_user;
$$;
create function public.save_ai_provider_key(p_user uuid,p_provider text,p_key text,p_models jsonb,p_selected text)
returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid;
begin
 if p_provider not in ('claude','gemini') or length(p_key)<20 or length(p_key)>512 or jsonb_typeof(p_models)<>'object' or (p_selected is not null and not p_models ? p_selected) then raise exception 'INVALID_KEY_SETTINGS'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select secret_id into sid from public.ai_provider_credentials where user_id=p_user for update;
 if sid is null then
  sid:=vault.create_secret(p_key,'marwan-ai-'||p_user::text,'User-managed AI API key');
 else
  perform vault.update_secret(sid,p_key);
 end if;
 insert into public.ai_provider_credentials(user_id,provider,secret_id,model_map,key_hint)
 values(p_user,p_provider,sid,p_models,right(p_key,4))
 on conflict(user_id) do update set provider=excluded.provider,model_map=excluded.model_map,key_hint=excluded.key_hint,checked_at=now();
 insert into public.preferences(user_id,ai_model) values(p_user,p_selected)
 on conflict(user_id) do update set ai_model=excluded.ai_model;
end $$;
create function public.delete_ai_provider_key(p_user uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 delete from public.ai_provider_credentials where user_id=p_user;
 update public.preferences set ai_model=null where user_id=p_user;
end $$;
revoke all on function public.read_ai_provider_key(uuid),public.save_ai_provider_key(uuid,text,text,jsonb,text),public.delete_ai_provider_key(uuid) from public,anon,authenticated;
grant execute on function public.read_ai_provider_key(uuid),public.save_ai_provider_key(uuid,text,text,jsonb,text),public.delete_ai_provider_key(uuid) to service_role;
grant select,insert,update on public.preferences to service_role;
