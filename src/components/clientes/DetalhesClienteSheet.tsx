import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Pencil, Wallet2, MapPin, Mail, Phone } from "lucide-react";
import type { CadastroClienteRow } from "@/components/clientes/CadastrarClienteDialog";
import { computeClienteProfilePercent } from "@/lib/clienteCompleteness";
import { useActivePage } from "@/contexts/ActivePageContext";
import type { Json } from "@/integrations/supabase/types";

import { FINANCEIRO_HIGHLIGHT_CLIENTE_ID_KEY } from "@/lib/sessionKeys";

function parseEnderecos(raw: Json): { rotulo: string; endereco: string }[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      return { rotulo: String(o.rotulo ?? ""), endereco: String(o.endereco ?? "") };
    })
    .filter(Boolean) as { rotulo: string; endereco: string }[];
}

interface Props {
  row: CadastroClienteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

export default function DetalhesClienteSheet({ row, open, onOpenChange, onEdit }: Props) {
  const { setActivePage } = useActivePage();
  const [loading, setLoading] = useState(false);
  const [nTransfer, setNTransfer] = useState(0);
  const [nGrupo, setNGrupo] = useState(0);
  const [sumTransfer, setSumTransfer] = useState(0);
  const [sumGrupo, setSumGrupo] = useState(0);

  useEffect(() => {
    if (!open || !row) {
      setNTransfer(0);
      setNGrupo(0);
      setSumTransfer(0);
      setSumGrupo(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const id = row.id;
      const [t1, t2, g1, g2] = await Promise.all([
        supabase.from("reservas_transfer").select("id", { count: "exact", head: true }).eq("cadastro_cliente_id", id),
        supabase.from("reservas_transfer").select("valor_total").eq("cadastro_cliente_id", id),
        supabase.from("reservas_grupos").select("id", { count: "exact", head: true }).eq("cadastro_cliente_id", id),
        supabase.from("reservas_grupos").select("valor_total").eq("cadastro_cliente_id", id),
      ]);
      if (cancelled) return;
      setNTransfer(t1.count ?? 0);
      setNGrupo(g1.count ?? 0);
      const st = (t2.data ?? []).reduce((a, r) => a + (Number((r as { valor_total?: number }).valor_total) || 0), 0);
      const sg = (g2.data ?? []).reduce((a, r) => a + (Number((r as { valor_total?: number }).valor_total) || 0), 0);
      setSumTransfer(st);
      setSumGrupo(sg);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row]);

  if (!row) return null;

  const pct = computeClienteProfilePercent(row);
  const enderecos = parseEnderecos(row.enderecos);
  const totalReservas = nTransfer + nGrupo;
  const totalFaturado = sumTransfer + sumGrupo;

  const goFinanceiro = () => {
    try {
      sessionStorage.setItem(FINANCEIRO_HIGHLIGHT_CLIENTE_ID_KEY, row.id);
    } catch {
      /* noop */
    }
    setActivePage("financeiro");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto border-l border-border p-0 sm:max-w-md">
        <div className="border-b border-border bg-card px-6 pb-4 pt-6">
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle className="text-xl text-foreground">Detalhes do cliente</SheetTitle>
            <p className="text-xs text-muted-foreground">Apenas os seus dados. Não partilhado com outros utilizadores.</p>
          </SheetHeader>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perfil no cadastro</span>
              <span className="text-xs font-semibold text-[#FF6600]">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-[#FF6600] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Complete endereços e documentos no menu CLIENTES para subir a percentagem.
            </p>
          </div>

          <div>
            <p className="text-lg font-semibold text-foreground">{row.nome_exibicao}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {row.tipo === "pj" ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Pessoa jurídica
                </span>
              ) : (
                "Pessoa física"
              )}
            </p>
          </div>

          <div className="space-y-2 text-sm">
            {row.email ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 text-[#FF6600]" />
                <span className="break-all">{row.email}</span>
              </p>
            ) : null}
            {row.telefone_1 ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-[#FF6600]" />
                {row.telefone_1}
              </p>
            ) : null}
            {row.telefone_2 ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                {row.telefone_2}
              </p>
            ) : null}
            {row.cpf_cnpj ? <p className="text-muted-foreground">CPF / CNPJ: {row.cpf_cnpj}</p> : null}
          </div>

          {enderecos.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Endereços</p>
              <ul className="space-y-2">
                {enderecos.map((e, i) => (
                  <li key={i} className="rounded-lg border border-border bg-muted/20 p-2 text-sm">
                    <p className="font-medium text-foreground">{e.rotulo || "—"}</p>
                    <p className="mt-1 flex gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {e.endereco || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-muted/15 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo (reservas)</p>
            {loading ? (
              <p className="mt-2 text-sm text-muted-foreground">A carregar…</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-foreground">
                  Viagens registadas: <strong>{totalReservas}</strong> ({nTransfer} transfer + {nGrupo} grupos)
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Valor total em reservas (referência):{" "}
                  <strong>
                    {totalFaturado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </strong>
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Integração completa com lançamentos financeiros automáticos virá nas próximas versões; aqui mostra-se só o
                  consolidado das reservas ligadas a este cliente.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit()}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button type="button" size="sm" className="bg-[#FF6600] text-white hover:bg-[#e65c00]" onClick={goFinanceiro}>
              <Wallet2 className="mr-2 h-4 w-4" />
              Abrir Financeiro
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
