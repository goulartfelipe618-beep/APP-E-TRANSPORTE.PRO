import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BadgeCheck, Building2, Loader2, MapPin, QrCode, Shield, ShieldAlert, User } from "lucide-react";

/** Aceita qualquer UUID em formato canónico (legado com token na path). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VerificacaoPayload = {
  ok: true;
  motorista_nome: string;
  empresa_nome: string;
  empresa_regime: "pj" | "pf";
  cnpj_mascarado: string | null;
  regiao: string | null;
  logo_url: string | null;
  foto_motorista_url: string | null;
  ref_publica: string;
};

export default function VerificarMotoristaPage() {
  const navigate = useNavigate();
  const { token: pathToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const gateJwt = (searchParams.get("g") || "").trim();
  const legacyUuid = (pathToken || "").trim();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<VerificacaoPayload | null>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, nofollow, noarchive");
    meta.setAttribute("data-verificar-motorista", "1");
    document.head.appendChild(meta);
    return () => {
      document.querySelector('meta[data-verificar-motorista="1"]')?.remove();
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    return () => {
      root.classList.remove("dark");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      setData(null);

      if (!gateJwt && (!legacyUuid || !UUID_RE.test(legacyUuid))) {
        setErr(null);
        setLoading(false);
        return;
      }

      const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!base || !anon) {
        setErr("Configuração do serviço indisponível.");
        setLoading(false);
        return;
      }

      const fnBase = base.replace(/\/$/, "");

      /** Caminho QR estável (/verificar-motorista/:uuid) → novo JWT à cada abertura. */
      if (!gateJwt && legacyUuid && UUID_RE.test(legacyUuid)) {
        try {
          const boot = await fetch(
            `${fnBase}/functions/v1/motorista-verificacao-public?session=1&qrt=${encodeURIComponent(legacyUuid)}`,
            {
              method: "GET",
              headers: {
                apikey: anon,
                Authorization: `Bearer ${anon}`,
              },
            },
          );
          const bootJson = (await boot.json()) as { jwt?: string; error?: string };
          if (!cancelled && boot.ok && typeof bootJson.jwt === "string" && bootJson.jwt.trim() !== "") {
            navigate(`/verificar-motorista?g=${encodeURIComponent(bootJson.jwt.trim())}`, { replace: true });
            return;
          }
        } catch {
          /* fallback ao token público direto */
        }

        try {
          const res = await fetch(
            `${fnBase}/functions/v1/motorista-verificacao-public?token=${encodeURIComponent(legacyUuid)}`,
            {
              method: "GET",
              headers: {
                apikey: anon,
                Authorization: `Bearer ${anon}`,
              },
            },
          );
          const json = (await res.json()) as VerificacaoPayload | { error?: string };
          if (cancelled) return;
          if (!res.ok || !("ok" in json) || !json.ok) {
            setErr((json as { error?: string }).error || "Não foi possível validar este registo.");
            return;
          }
          setData(json);
        } catch {
          if (!cancelled) setErr("Erro de rede. Tente novamente.");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      const url =
        `${fnBase}/functions/v1/motorista-verificacao-public?g=${encodeURIComponent(gateJwt)}`;

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
          },
        });
        const json = (await res.json()) as VerificacaoPayload | { error?: string };
        if (cancelled) return;
        if (!res.ok || !("ok" in json) || !json.ok) {
          setErr((json as { error?: string }).error || "Não foi possível validar este registo.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setErr("Erro de rede. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateJwt, legacyUuid, navigate]);

  if (!gateJwt && (!legacyUuid || !UUID_RE.test(legacyUuid))) {
    return (
      <div className="relative min-h-screen min-h-[100dvh] overflow-hidden bg-[#0f1419] text-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,102,0,0.12), transparent 45%), radial-gradient(circle at 80% 60%, rgba(201,162,39,0.08), transparent 40%)",
          }}
        />
        <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
          <div className="rounded-2xl border border-amber-500/25 bg-[#151b24]/95 p-8 text-center shadow-2xl backdrop-blur">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/35">
              <ShieldAlert className="h-8 w-8 text-amber-400" />
            </div>
            <h1 className="text-lg font-semibold text-white">Selo digital</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Utilize o QR no final da ficha PDF do motorista. O <strong className="text-white/85">QR da ficha não muda</strong>{" "}
              entre exportações; ao abrir a página, o sistema gera um <strong className="text-white/85">link de sessão</strong>{" "}
              diferente (recarregar ou voltar a digitalizar gera outro).
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/50">
              <QrCode className="h-4 w-4 shrink-0 text-[#c9a227]" />
              <span>Fichas antigas com link de uso único continuam válidas até serem consumidas.</span>
            </div>
            <p className="mt-8 text-center text-xs text-white/40">
              <Link to="/login" className="text-[#FF6600] underline-offset-4 hover:underline">
                Aceder ao painel
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen min-h-[100dvh] overflow-hidden bg-[#0f1419] text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,102,0,0.12), transparent 45%), radial-gradient(circle at 80% 60%, rgba(201,162,39,0.08), transparent 40%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#151b24]/90 p-10 shadow-2xl backdrop-blur">
            <Loader2 className="h-10 w-10 animate-spin text-[#FF6600]" />
            <p className="text-sm text-white/70">A validar credenciais…</p>
          </div>
        ) : err ? (
          <div className="rounded-2xl border border-red-500/30 bg-[#151b24]/95 p-8 text-center shadow-2xl">
            <Shield className="mx-auto mb-3 h-10 w-10 text-red-400/90" />
            <h1 className="text-lg font-semibold text-white">Verificação indisponível</h1>
            <p className="mt-2 text-sm text-white/65">{err}</p>
          </div>
        ) : data ? (
          <div className="overflow-hidden rounded-2xl border border-[#c9a227]/35 bg-[#151b24]/95 shadow-2xl backdrop-blur">
            <div className="border-b border-white/10 bg-gradient-to-r from-[#1a2744] to-[#151b24] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#c9a227]/20 ring-1 ring-[#c9a227]/40">
                  <BadgeCheck className="h-7 w-7 text-[#c9a227]" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9a227]/90">Selo de autenticidade</p>
                  <h1 className="text-lg font-bold tracking-tight text-white">Motorista oficial</h1>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-7">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[#c9a227]/40 bg-black/30 shadow-inner">
                  {data.foto_motorista_url ? (
                    <img src={data.foto_motorista_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/35">
                      <User className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-xs font-medium uppercase tracking-wide text-white/50">Motorista credenciado</p>
                  <p className="mt-1 text-xl font-bold text-white">{data.motorista_nome}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    <Shield className="h-3.5 w-3.5" />
                    Vínculo ativo com operador
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 flex items-center gap-2 text-[#c9a227]">
                  <Building2 className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Operador / empresa</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {data.logo_url ? (
                    <img src={data.logo_url} alt="" className="h-11 max-w-[120px] rounded-lg border border-white/10 bg-white object-contain p-1" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white/60">
                      E
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{data.empresa_nome}</p>
                    <p className="mt-0.5 text-xs text-white/55">
                      {data.empresa_regime === "pj" ? "Pessoa jurídica" : "Prestador (pessoa física)"}
                    </p>
                    {data.empresa_regime === "pj" && data.cnpj_mascarado ? (
                      <p className="mt-1 font-mono text-xs text-white/70">CNPJ {data.cnpj_mascarado}</p>
                    ) : null}
                  </div>
                </div>
                {data.regiao ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-white/60">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF6600]" />
                    Região base: {data.regiao}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-center">
                <p className="text-[11px] uppercase tracking-wider text-white/45">Referência pública</p>
                <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-[#FF6600]">{data.ref_publica}</p>
              </div>

              <p className="text-center text-[11px] leading-relaxed text-white/45">
                Esta página confirma apenas a autenticidade do vínculo entre o motorista indicado e o operador acima.
                Não exibe documentos confidenciais, morada completa nem dados fiscais sensíveis.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
