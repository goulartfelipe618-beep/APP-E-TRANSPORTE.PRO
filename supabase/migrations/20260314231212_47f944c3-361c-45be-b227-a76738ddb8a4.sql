
-- Allow drivers to see networks assigned to them
CREATE POLICY "Drivers can view assigned networks"
ON public.network
FOR SELECT
TO authenticated
USING (motorista_atribuido_id::uuid = auth.uid());
