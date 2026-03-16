
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own progress' AND tablename = 'mentoria_progresso') THEN
    CREATE POLICY "Users can view own progress" ON public.mentoria_progresso FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own progress' AND tablename = 'mentoria_progresso') THEN
    CREATE POLICY "Users can insert own progress" ON public.mentoria_progresso FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own progress' AND tablename = 'mentoria_progresso') THEN
    CREATE POLICY "Users can update own progress" ON public.mentoria_progresso FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin master can view all progress' AND tablename = 'mentoria_progresso') THEN
    CREATE POLICY "Admin master can view all progress" ON public.mentoria_progresso FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin_master'));
  END IF;
END $$;
