
CREATE POLICY "Admin master can view all transfer reservations" ON public.reservas_transfer FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can view all group reservations" ON public.reservas_grupos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can view all transfer requests" ON public.solicitacoes_transfer FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can view all group requests" ON public.solicitacoes_grupos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can view all driver requests" ON public.solicitacoes_motoristas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can view all configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
CREATE POLICY "Admin master can view all automacoes" ON public.automacoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
