import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { purgeR2Record } from "@/lib/r2Registro";
import { toast } from "sonner";
import CriarReservaGrupoDialog from "@/components/grupos/CriarReservaGrupoDialog";
import DetalhesReservaGrupoSheet from "@/components/reservas/DetalhesReservaGrupoSheet";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateGrupoPDF, getGrupoReservaPdfBase64 } from "@/lib/pdfGenerator";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { Tables } from "@/integrations/supabase/types";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { badgeToneReservaStatus, labelReservaStatus, RESERVA_STATUS_OPTIONS } from "@/lib/reservaStatus";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDbCalendarDatePtBr, toAgendaDayKey } from "@/lib/painelAgendaReservas";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { mostrarValorReserva } from "@/lib/valorReservaJanela";
import { useUserPlan } from "@/hooks/useUserPlan";
import { freePlanLockedReservaIdsByCreationDay } from "@/lib/freePlanLocks";
import { cn } from "@/lib/utils";
import ReservaListaAcoes from "@/components/reservas/ReservaListaAcoes";
import { usePainelListPagination } from "@/hooks/usePainelListPagination";
import { PainelPaginationBar } from "@/components/painel/PainelPaginationBar";
import { buildGrupoDadosComunicarCliente } from "@/lib/comunicarReservaCliente";
import { fetchAllSupabasePages } from "@/lib/supabaseFetchAll";

type ReservaGrupo = Tables<"reservas_grupos">;

const veiculoLabel: Record<string, string> = {
  van: "Van",
  micro_onibus: "Micro-ônibus",
  onibus: "Ônibus",
};

export default function GruposReservasPage() {
  const { plano, loading: planLoading } = useUserPlan();
  const { config } = useConfiguracoes();
  const financeiroBloqueado = config.financeiro_bloqueado === true;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservaGrupoEdicao, setReservaGrupoEdicao] = useState<ReservaGrupo | null>(null);
  const [reservas, setReservas] = useState<ReservaGrupo[]>([]);
  const [motoristasOpts, setMotoristasOpts] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReservaGrupo | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarLinha, setComunicarLinha] = useState<ReservaGrupo | null>(null);
  const [comunicarPayload, setComunicarPayload] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [filterDataDe, setFilterDataDe] = useState("");
  const [filterDataAte, setFilterDataAte] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMotorista, setFilterMotorista] = useState<string>("all");
  const [filterVeiculo, setFilterVeiculo] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setReservas([]);
      setMotoristasOpts([]);
      setLoading(false);
      return;
    }

    const [res, mot] = await Promise.all([
      fetchAllSupabasePages((from, to) =>
        supabase
          .from("reservas_grupos")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      supabase
        .from("solicitacoes_motoristas")
        .select("id, nome, portal_auth_user_id")
        .eq("user_id", uid)
        .eq("status", "cadastrado")
        .not("portal_auth_user_id", "is", null),
    ]);

    if (res.error) toast.error("Erro ao carregar reservas de grupos");
    else setReservas((res.data as ReservaGrupo[]) || []);

    if (!mot.error && mot.data) {
      setMotoristasOpts(
        (mot.data as { portal_auth_user_id: string | null; nome: string }[])
          .filter((m) => m.portal_auth_user_id != null)
          .map((m) => ({ id: m.portal_auth_user_id as string, nome: m.nome })),
      );
    } else {
      setMotoristasOpts([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const motoristaNome = useCallback(
    (motoristaId: string | null) => {
      const mid = (motoristaId ?? "").trim();
      if (!mid) return "—";
      return motoristasOpts.find((m) => m.id === mid)?.nome ?? "Motorista atribuído";
    },
    [motoristasOpts],
  );

  const motoristaCell = (r: ReservaGrupo) => {
    const nome = (r.nome_motorista ?? "").trim();
    if (nome) return nome;
    return motoristaNome(r.motorista_id);
  };

  const reservasFiltradas = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return reservas.filter((r) => {
      if (filterStatus !== "all" && (r.status ?? "").trim() !== filterStatus) return false;
      if (filterMotorista !== "all") {
        const mid = (r.motorista_id ?? "").trim();
        if (filterMotorista === "__sem__") {
          if (mid !== "") return false;
        } else if (mid !== filterMotorista) return false;
      }
      if (filterVeiculo !== "all") {
        const tv = (r.tipo_veiculo ?? "").trim();
        if (tv !== filterVeiculo) return false;
      }
      const dayKey = toAgendaDayKey(r.data_ida);
      if (filterDataDe) {
        if (!dayKey || dayKey < filterDataDe) return false;
      }
      if (filterDataAte) {
        if (!dayKey || dayKey > filterDataAte) return false;
      }
      if (q) {
        const blob = `${r.nome_completo ?? ""} ${r.whatsapp ?? ""} ${r.email ?? ""} ${r.numero_reserva ?? ""} ${r.embarque ?? ""} ${r.destino ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [reservas, filterDataDe, filterDataAte, filterStatus, filterMotorista, filterVeiculo, filterSearch]);

  const { slice: reservasPage, page, setPage, totalPages, totalItems } = usePainelListPagination(reservasFiltradas);

  const freeLockedReservaIds = useMemo(
    () => freePlanLockedReservaIdsByCreationDay(plano, reservas.map((r) => ({ id: r.id, created_at: r.created_at }))),
    [plano, reservas],
  );

  const limparFiltros = () => {
    setFilterDataDe("");
    setFilterDataAte("");
    setFilterStatus("all");
    setFilterMotorista("all");
    setFilterVeiculo("all");
    setFilterSearch("");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("reservas_grupos").delete().eq("id", deleteId);
      if (error) toast.error("Erro ao excluir");
      else {
        try {
          await purgeR2Record("reservas_grupos", deleteId);
        } catch (e) {
          toast.warning(e instanceof Error ? e.message : "Reserva excluída, mas o arquivo na Cloudflare ficou.");
        }
        toast.success("Reserva excluída");
        setDeleteId(null);
        fetchAll();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const comunicarSeq = useRef(0);
  const handleComunicar = async (r: ReservaGrupo) => {
    const seq = ++comunicarSeq.current;
    try {
      const payload = await buildGrupoDadosComunicarCliente(r);
      if (seq !== comunicarSeq.current) return;
      setComunicarLinha(r);
      setComunicarPayload(payload);
      setComunicarOpen(true);
    } catch {
      if (seq !== comunicarSeq.current) return;
      toast.error("Erro ao preparar dados para comunicação.");
    }
  };

  const handleDownload = async (r: ReservaGrupo) => {
    toast.info("Gerando PDF...");
    await generateGrupoPDF(r.id);
  };

  const filtrosAtivos =
    filterDataDe !== "" ||
    filterDataAte !== "" ||
    filterStatus !== "all" ||
    filterMotorista !== "all" ||
    filterVeiculo !== "all" ||
    filterSearch.trim() !== "";

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Reservas de Grupos</h1>
          <p className="text-pretty break-words text-muted-foreground">
            Reservas convertidas a partir de solicitações de grupos ({reservasFiltradas.length}
            {filtrosAtivos ? ` de ${reservas.length}` : ""})
            {!planLoading && freeLockedReservaIds.size > 0 ? (
              <span className="mt-1 block text-xs text-muted-foreground sm:ml-2 sm:mt-0 sm:inline">
                · {freeLockedReservaIds.size} reserva(s) acima do limite diário do plano FREE (visíveis; ações limitadas)
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 sm:h-9 sm:w-9" onClick={fetchAll} aria-label="Atualizar lista">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            className="min-h-10 flex-1 bg-primary px-4 text-primary-foreground sm:min-h-9 sm:flex-initial"
            onClick={() => {
              setReservaGrupoEdicao(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" /> Criar Reserva
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-[#FF6600]" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
          {filtrosAtivos ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={limparFiltros}>
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data ida (de)</Label>
            <Input type="date" value={filterDataDe} onChange={(e) => setFilterDataDe(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data ida (até)</Label>
            <Input type="date" value={filterDataAte} onChange={(e) => setFilterDataAte(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {RESERVA_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Motorista</Label>
            <Select value={filterMotorista} onValueChange={setFilterMotorista}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="__sem__">Sem motorista</SelectItem>
                {motoristasOpts.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Veículo</Label>
            <Select value={filterVeiculo} onValueChange={setFilterVeiculo}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(veiculoLabel).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <Label className="text-xs text-muted-foreground">Cliente / contacto / trajeto</Label>
            <Input
              placeholder="Pesquisar…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando...</p>
        ) : reservasFiltradas.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6">
            {reservas.length === 0 ? "Nenhuma reserva encontrada." : "Nenhuma reserva corresponde aos filtros."}
          </p>
        ) : (
          <div className="p-0">
            <div className="divide-y divide-border md:hidden">
              {reservasPage.map((r) => {
                const rowLocked = !planLoading && freeLockedReservaIds.has(r.id);
                return (
                  <article key={r.id} className={cn("space-y-2 p-3", rowLocked && "bg-muted/30")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("truncate font-medium", rowLocked && "opacity-60")}>{r.nome_completo}</p>
                        <p className={cn("text-xs text-muted-foreground", rowLocked && "opacity-60")}>
                          #{r.numero_reserva} · {r.whatsapp}
                        </p>
                      </div>
                      <Badge variant={badgeToneReservaStatus(r.status)} className={cn("shrink-0", rowLocked && "opacity-60")}>
                        {labelReservaStatus(r.status)}
                      </Badge>
                    </div>
                    <p className={cn("break-words text-sm text-muted-foreground", rowLocked && "opacity-60")}>
                      {r.embarque && r.destino ? `${r.embarque} → ${r.destino}` : "—"}
                    </p>
                    <div className={cn("flex flex-wrap items-center gap-1", rowLocked && "opacity-60")}>
                      {r.tipo_veiculo ? <Badge variant="secondary">{veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo}</Badge> : null}
                      {r.perna_viagem === "ida" || r.perna_viagem === "volta" ? (
                        <Badge variant="outline" className="border-[#FF6600]/60 text-[#FF6600]">
                          {r.perna_viagem === "volta" ? "VOLTA" : "IDA"}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{formatDbCalendarDatePtBr(r.data_ida)}</span>
                      <span className="text-sm font-semibold">
                        {mostrarValorReserva(financeiroBloqueado, [r.data_ida, r.data_retorno])
                          ? Number(r.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "—"}
                      </span>
                    </div>
                    <ReservaListaAcoes
                      locked={rowLocked}
                      onEdit={() => {
                        setReservaGrupoEdicao(r);
                        setDialogOpen(true);
                      }}
                      onView={() => {
                        setSelected(r);
                        setSheetOpen(true);
                      }}
                      onComunicar={() => void handleComunicar(r)}
                      onDownload={() => handleDownload(r)}
                      onDelete={() => setDeleteId(r.id)}
                    />
                  </article>
                );
              })}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Perna</TableHead>
                  <TableHead>Passageiros</TableHead>
                  <TableHead>Trajeto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {reservasPage.map((r) => {
                const rowLocked = !planLoading && freeLockedReservaIds.has(r.id);
                return (
                <TableRow key={r.id} className={cn(rowLocked && "bg-muted/30")}>
                  <TableCell className={cn("font-mono text-sm text-muted-foreground", rowLocked && "opacity-60")}>#{r.numero_reserva}</TableCell>
                  <TableCell className={cn("font-medium", rowLocked && "opacity-60")}>{r.nome_completo}</TableCell>
                  <TableCell className={cn(rowLocked && "opacity-60")}>
                    <div className="text-sm">{r.whatsapp}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell className={cn(rowLocked && "opacity-60")}>{r.tipo_veiculo ? <Badge variant="secondary">{veiculoLabel[r.tipo_veiculo] || r.tipo_veiculo}</Badge> : "—"}</TableCell>
                  <TableCell className={cn(rowLocked && "opacity-60")}>
                    {r.perna_viagem === "ida" || r.perna_viagem === "volta" ? (
                      <Badge
                        variant="outline"
                        className="border-[#FF6600]/60 text-[#FF6600] dark:border-[#FF6600]/50 dark:text-[#FF6600]"
                      >
                        {r.perna_viagem === "volta" ? "VOLTA" : "IDA"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(rowLocked && "opacity-60")}>{r.num_passageiros ?? "—"}</TableCell>
                  <TableCell className={cn("max-w-[200px] truncate text-sm", rowLocked && "opacity-60")}>
                    {r.embarque && r.destino ? `${r.embarque} → ${r.destino}` : "—"}
                  </TableCell>
                  <TableCell className={cn("text-sm", rowLocked && "opacity-60")}>{formatDbCalendarDatePtBr(r.data_ida)}</TableCell>
                  <TableCell className={cn("max-w-[160px] truncate text-sm text-muted-foreground", rowLocked && "opacity-60")}>{motoristaCell(r)}</TableCell>
                  <TableCell className={cn("font-semibold", rowLocked && "opacity-60")}>
                    {mostrarValorReserva(financeiroBloqueado, [r.data_ida, r.data_retorno])
                      ? Number(r.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                  <TableCell className={cn(rowLocked && "opacity-60")}>
                    <Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <ReservaListaAcoes
                      locked={rowLocked}
                      onEdit={() => {
                        setReservaGrupoEdicao(r);
                        setDialogOpen(true);
                      }}
                      onView={() => {
                        setSelected(r);
                        setSheetOpen(true);
                      }}
                      onComunicar={() => void handleComunicar(r)}
                      onDownload={() => handleDownload(r)}
                      onDelete={() => setDeleteId(r.id)}
                    />
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
            </div>
          <div className="px-4 pb-4">
            <PainelPaginationBar page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={setPage} />
          </div>
        </div>
        )}
      </div>

      <CriarReservaGrupoDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setReservaGrupoEdicao(null);
        }}
        onCreated={fetchAll}
        reservaGrupoEdicao={reservaGrupoEdicao}
      />

      <DetalhesReservaGrupoSheet
        reserva={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComunicar={handleComunicar}
        onDownload={handleDownload}
      />

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir reserva de grupo?"
        description="Esta ação remove permanentemente a reserva do sistema. Deseja continuar?"
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {comunicarLinha && comunicarPayload && (
        <ComunicarDialog
          key={comunicarLinha.id}
          open={comunicarOpen}
          onOpenChange={(o) => {
            setComunicarOpen(o);
            if (!o) {
              setComunicarLinha(null);
              setComunicarPayload(null);
            }
          }}
          dados={comunicarPayload}
          telefone={
            typeof comunicarPayload.whatsapp === "string" && comunicarPayload.whatsapp.trim() !== ""
              ? comunicarPayload.whatsapp
              : comunicarLinha.whatsapp
          }
          titulo="Comunicar — Reserva de Grupo"
          onGerarPDF={() => generateGrupoPDF(comunicarLinha.id)}
          webhookTipo="grupo_reserva"
          getConfirmacaoReservaPdfBase64={() => getGrupoReservaPdfBase64(comunicarLinha.id)}
        />
      )}
    </div>
  );
}
