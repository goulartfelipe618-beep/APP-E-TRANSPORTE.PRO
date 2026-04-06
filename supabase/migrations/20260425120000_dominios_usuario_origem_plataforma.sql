-- Origem do cadastro: domínio já existente em terceiros ou intenção de novo .com.br
ALTER TABLE public.dominios_usuario
  ADD COLUMN IF NOT EXISTS tipo_origem text
    CHECK (tipo_origem IS NULL OR tipo_origem IN ('ja_registrado', 'novo_com_br'));

ALTER TABLE public.dominios_usuario
  ADD COLUMN IF NOT EXISTS plataforma_registro text;

COMMENT ON COLUMN public.dominios_usuario.tipo_origem IS 'ja_registrado: domínio já comprado; novo_com_br: solicitação de registro com sufixo .com.br fixo.';
COMMENT ON COLUMN public.dominios_usuario.plataforma_registro IS 'Plataforma onde o domínio foi registrado (quando tipo_origem = ja_registrado).';
