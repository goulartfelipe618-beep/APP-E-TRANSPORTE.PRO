-- Remove modelo 5: migrar dados e restringir a 1–4.
update public.receptivos set modelo = 4 where modelo = 5;

alter table public.receptivos drop constraint if exists receptivos_modelo_check;

alter table public.receptivos
  add constraint receptivos_modelo_check check (modelo >= 1 and modelo <= 4);
