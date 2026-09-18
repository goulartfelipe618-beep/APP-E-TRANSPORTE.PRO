-- Evita 409 no POST /user_activity_log quando o índice único de primeiro acesso já existe.

CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_action_code text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.user_activity_log (user_id, action_code, message, metadata)
  VALUES (auth.uid(), p_action_code, p_message, COALESCE(p_metadata, '{}'::jsonb));
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_activity(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_user_activity(text, text, jsonb) TO authenticated;
