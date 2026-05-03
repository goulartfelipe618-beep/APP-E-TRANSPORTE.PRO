import { useEffect } from "react";
import { Link } from "react-router-dom";
import { QrCode, ShieldAlert } from "lucide-react";

/** Rota `/verificar-motorista` sem token (PDF antigo ou link cortado). */
export default function VerificarMotoristaSemCodigoPage() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    return () => {
      root.classList.remove("dark");
    };
  }, []);

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
          <h1 className="text-lg font-semibold text-white">Link incompleto</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            O código de verificação não veio no endereço. Peça ao operador o PDF atualizado ou o link completo que inclui o identificador após{" "}
            <span className="font-mono text-[#FF6600]">/verificar-motorista/</span>.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/50">
            <QrCode className="h-4 w-4 shrink-0 text-[#c9a227]" />
            <span>Digitalize o QR no final da ficha oficial do motorista.</span>
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
