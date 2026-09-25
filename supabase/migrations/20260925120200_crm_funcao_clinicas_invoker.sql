-- A função só devolve as clínicas do próprio usuário; com a policy de
-- usuarios_clinica ela não precisa de SECURITY DEFINER, e sem ele o
-- advisor do Supabase para de apontar uma função definer exposta por RPC.
create or replace function public.clinicas_do_usuario()
returns setof uuid
language sql stable security invoker
set search_path = public
as $$
  select clinica_id from public.usuarios_clinica where user_id = auth.uid()
$$;
revoke all on function public.clinicas_do_usuario() from public;
revoke execute on function public.clinicas_do_usuario() from anon;
grant execute on function public.clinicas_do_usuario() to authenticated;
