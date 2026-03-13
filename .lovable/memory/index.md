Design preferences and backend config for E-Transporte.pro

- Uses Lovable Cloud (Supabase under the hood) — NOT external Supabase
- Dark theme login with luxury car background, captcha, email/password
- Post-login redirects to /dashboard
- Language: Portuguese (pt-BR)
- Supabase client at src/integrations/supabase/client.ts
- Auth: signup disabled, auto-confirm off
- User roles: admin_transfer, admin_taxi, admin_master (app_role enum)
- Admin user: felipe.goulart06@hotmail.com = admin_transfer
- "/" redirects to "/login", dashboard is protected
