import { createClient } from "@supabase/supabase-js";
import { logger } from "../logger.mjs";

/**
 * Valida JWT do Supabase (Authorization: Bearer <access_token>).
 * Documentação: Auth + API — middleware JWT no backend.
 */
export function authSupabaseMiddleware(options = {}) {
  const { optional = false } = options;

  return async function authSupabase(req, res, next) {
    const header = req.get("authorization") || req.get("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      if (optional) return next();
      return res.status(401).json({ error: "Não autorizado" });
    }

    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (!url || !anon) {
      logger.error("SUPABASE_URL ou SUPABASE_ANON_KEY em falta no servidor");
      return res.status(500).json({ error: "Configuração do servidor incompleta" });
    }

    try {
      const supabase = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        if (optional) return next();
        return res.status(401).json({ error: "Sessão inválida ou expirada" });
      }

      req.supabaseUser = user;
      req.supabaseJwt = token;
      next();
    } catch (e) {
      logger.warn("authSupabase falhou", { message: e instanceof Error ? e.message : String(e) });
      if (optional) return next();
      return res.status(401).json({ error: "Não autorizado" });
    }
  };
}
