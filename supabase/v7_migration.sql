-- KHOJ v7 migration — run ONCE in the Supabase SQL editor (after v4–v6). Safe to re-run.
--
-- Fixes "permission denied for function clear_khoj_data" on the admin dashboard's Clear records button
-- by (re)granting the right to call it. The function itself still refuses anyone who is not in
-- admin_users, so granting execute does not let other users clear anything.

grant usage on schema public to anon, authenticated;
grant execute on function public.clear_khoj_data(text[]) to authenticated, service_role;
-- Some projects call the API with the anon role until the session loads; the admin check inside
-- the function rejects them anyway.
grant execute on function public.clear_khoj_data(text[]) to anon;

-- Make sure the same is true of the visitor function used for each student's account.
grant execute on function public.register_visitor(text) to authenticated;

notify pgrst, 'reload schema';
