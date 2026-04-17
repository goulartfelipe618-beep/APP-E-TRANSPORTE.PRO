import { CheckCircle2, Clock, MapPin, Navigation, Route, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Rastreio = Tables<"rastreios_ao_vivo">;

export type ResumoViagemCardProps = {
  rastreio: Pick<
    Rastreio,
    | "origem_endereco"
    | "destino_endereco"
    | "distancia_total_km"
    | "duracao_segundos"
    | "valor_total"
    | "data_hora_fim"
    | "iniciado_em"
    | "motorista_nome"
    | "veiculo_descricao"
    | "status"
  >;
  className?: string;
};

function formatDuracao(segundos: number | null | undefined): string {
  if (!segundos || segundos <= 0) return "—";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  return `${m} min`;
}

function formatDistancia(km: number | string | null | undefined): string {
  if (km === null || km === undefined) return "—";
  const n = typeof km === "string" ? Number(km) : km;
  if (!Number.isFinite(n)) return "—";
  if (n < 1) return `${Math.round(n * 1000)} m`;
  return `${n.toFixed(2).replace(".", ",")} km`;
}

function formatMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function ResumoViagemCard({ rastreio, className }: ResumoViagemCardProps) {
  const concluida = rastreio.status === "concluida";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      aria-label="Resumo da viagem"
    >
      <header className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            concluida ? "bg-[#FF6600]/15 text-[#FF6600]" : "bg-muted text-muted-foreground",
          )}
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">
            Resumo da viagem
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {concluida
              ? "Viagem encerrada. Dados de GPS foram removidos; apenas o resultado foi mantido."
              : "Viagem ainda em andamento."}
          </p>
        </div>
        {concluida && (
          <span className="hidden shrink-0 rounded-full border border-[#FF6600]/40 bg-[#FF6600]/10 px-2.5 py-1 text-xs font-semibold text-[#FF6600] sm:inline-flex">
            Concluída
          </span>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <InfoItem
          icon={<MapPin className="h-4 w-4 text-[#FF6600]" />}
          label="Origem"
          value={rastreio.origem_endereco ?? "—"}
        />
        <InfoItem
          icon={<Navigation className="h-4 w-4 text-[#FF6600]" />}
          label="Destino"
          value={rastreio.destino_endereco ?? "—"}
        />
        <InfoItem
          icon={<Route className="h-4 w-4 text-[#FF6600]" />}
          label="Distância total"
          value={formatDistancia(rastreio.distancia_total_km)}
        />
        <InfoItem
          icon={<Clock className="h-4 w-4 text-[#FF6600]" />}
          label="Tempo total"
          value={formatDuracao(rastreio.duracao_segundos)}
        />
        <InfoItem
          icon={<Wallet className="h-4 w-4 text-[#FF6600]" />}
          label="Valor"
          value={formatMoeda(rastreio.valor_total)}
        />
        <InfoItem
          icon={<Clock className="h-4 w-4 text-[#FF6600]" />}
          label="Encerrada em"
          value={formatDataHora(rastreio.data_hora_fim)}
        />
      </div>

      {(rastreio.motorista_nome || rastreio.veiculo_descricao) && (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          {rastreio.motorista_nome && (
            <span>
              Motorista:{" "}
              <span className="font-medium text-foreground">{rastreio.motorista_nome}</span>
            </span>
          )}
          {rastreio.veiculo_descricao && (
            <span>
              Veículo:{" "}
              <span className="font-medium text-foreground">{rastreio.veiculo_descricao}</span>
            </span>
          )}
          <span>
            Início:{" "}
            <span className="font-medium text-foreground">
              {formatDataHora(rastreio.iniciado_em)}
            </span>
          </span>
        </footer>
      )}
    </section>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
