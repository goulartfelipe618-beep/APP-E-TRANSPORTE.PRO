/**
 * Mitigação CSRF para APIs que aceitam cookies (não é o caso do Supabase JS por defeito).
 * Para pedidos mutadores com Origin presente, exige correspondência com ALLOWED_ORIGINS.
 * Documentação: Ataques comuns — CSRF / origem confiável.
 */
export function originAllowlistMiddleware() {
  const raw = process.env.ALLOWED_ORIGINS || "";
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  return function originAllowlist(req, res, next) {
    if (process.env.NODE_ENV !== "production") return next();
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();

    const origin = req.get("origin");
    if (!origin) return next();
    if (allowed.size === 0) {
      return res.status(403).json({ error: "Origem não permitida (configure ALLOWED_ORIGINS)" });
    }
    if (!allowed.has(origin)) {
      return res.status(403).json({ error: "Origem não permitida" });
    }
    next();
  };
}
