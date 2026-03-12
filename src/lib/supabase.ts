import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://leqzzvprqjkwdyyqtglf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcXp6dnBycWprd2R5eXF0Z2xmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTg3NTQsImV4cCI6MjA4ODkzNDc1NH0.f5Oe5lkf-6HTWQdRKdWXt-5y1gLqVmE2-ux7bgCXtNU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
