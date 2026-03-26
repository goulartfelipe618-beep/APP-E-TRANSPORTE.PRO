-- Stores the UUID of the auth user created for the lead (login created from landing form)
-- so the Admin Master can disable/delete that user from the Landing Page table.

alter table public.solicitacoes_motoristas
add column if not exists lead_user_id uuid;

create index if not exists solicitacoes_motoristas_lead_user_id_idx
on public.solicitacoes_motoristas (lead_user_id);

