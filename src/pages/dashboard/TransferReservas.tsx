import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Trash2, Eye, MessageSquare, Download, Pencil, Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CriarReservaTransferDialog from "@/components/transfer/CriarReservaTransferDialog";
import DetalhesReservaTransferSheet from "@/components/reservas/DetalhesReservaTransferSheet";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateTransferPDF, getTransferReservaPdfBase64 } from "@/lib/pdfGenerator";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { Tables } from "@/integrations/supabase/types";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { badgeToneReservaStatus, labelReservaStatus, RESERVA_STATUS_OPTIONS } from "@/lib/reservaStatus";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDbCalendarDatePtBr, toAgendaDayKey } from "@/lib/painelAgendaReservas";

type Reserva = Tables<"reservas_transfer">;

const tipoLabel: Record<string, string> = {
  somente_ida: "Somente Ida",
  ida_volta: "Ida e Volta",
  por_hora: "Por Hora",
};

function transferPrimaryDayKey(r: Reserva): string | null {
  if (r.tipo_viagem === "por_hora") return toAgendaDayKey(r.por_hora_data) ?? toAgendaDayKey(r.ida_data);
  return toAgendaDayKey(r.ida_data);
}

function transferDisplayDateCell(r: Reserva): string {
  if (r.tipo_viagem === "por_hora") return formatDbCalendarDatePtBr(r.por_hora_data ?? r.ida_data);
  return formatDbCalendarDatePtBr(r.ida_data);
}

export default function TransferReservasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reservaEdicao, setReservaEdicao] = useState<Reserva | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [motoristasOpts, setMotoristasOpts] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Reserva | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarDados, setComunicarDados] = useState<Reserva | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [filterDataDe, setFilterDataDe] = useState("");
  const [filterDataAte, setFilterDataAte] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMotorista, setFilterMotorista] = useState<string>("all");
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
      supabase.from("reservas_transfer").select("*").order("created_at", { ascending: false }),
      supabase
        .from("solicitacoes_motoristas")
        .select("id, nome, portal_auth_user_id")
        .eq("user_id", uid)
        .eq("status", "cadastrado")
        .not("portal_auth_user_id", "is", null),
    ]);

    if (res.error) toast.error("Erro ao carregar reservas");
    else setReservas((res.data as Reserva[]) || []);

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
      const dayKey = transferPrimaryDayKey(r);
      if (filterDataDe) {
        if (!dayKey || dayKey < filterDataDe) return false;
      }
      if (filterDataAte) {
        if (!dayKey || dayKey > filterDataAte) return false;
      }
      if (q) {
        const blob = `${r.nome_completo ?? ""} ${r.telefone ?? ""} ${r.email ?? ""} ${r.numero_reserva ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [reservas, filterDataDe, filterDataAte, filterStatus, filterMotorista, filterSearch]);

  const limparFiltros = () => {
    setFilterDataDe("");
    setFilterDataAte("");
    setFilterStatus("all");
    setFilterMotorista("all");
    setFilterSearch("");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("reservas_transfer").delete().eq("id", deleteId);
      if (error) toast.error("Erro ao excluir");
      else {
        toast.success("Reserva excluída");
        setDeleteId(null);
        fetchAll();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleComunicar = (r: Reserva) => {
    setComunicarDados(r);
    setComunicarOpen(true);
  };

  const handleDownload = async (r: Reserva) => {
    toast.info("Gerando PDF...");
    await generateTransferPDF(r.id);
  };

  const filtrosAtivos =
    filterDataDe !== "" ||
    filterDataAte !== "" ||
    filterStatus !== "all" ||
    filterMotorista !== "all" ||
    filterSearch.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reservas</h1>
          <p className="text-muted-foreground">
            Transfer ({reservasFiltradas.length}
            {filtrosAtivos ? ` de ${reservas.length}` : ""})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => {
              setReservaEdicao(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Criar Reserva
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data (de)</Label>
            <Input type="date" value={filterDataDe} onChange={(e) => setFilterDataDe(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data (até)</Label>
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
          <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
            <Label className="text-xs text-muted-foreground">Cliente / contacto / nº</Label>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Trajeto</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservasFiltradas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">#{r.numero_reserva}</TableCell>
                  <TableCell className="font-medium">{r.nome_completo}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.telefone}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tipoLabel[r.tipo_viagem] || r.tipo_viagem}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {r.ida_embarque && r.ida_desembarque ? `${r.ida_embarque} → ${r.ida_desembarque}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{transferDisplayDateCell(r)}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-sm text-muted-foreground">
                    {motoristaNome(r.motorista_id)}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {Number(r.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeToneReservaStatus(r.status)}>{labelReservaStatus(r.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setReservaEdicao(r);
                          setDialogOpen(true);
                        }}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelected(r); setSheetOpen(true); }} title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleComunicar(r)} title="Comunicar">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(r)} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CriarReservaTransferDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setReservaEdicao(null);
        }}
        onCreated={fetchAll}
        reservaEdicao={reservaEdicao}
      />

      <DetalhesReservaTransferSheet
        reserva={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComunicar={handleComunicar}
        onDownload={handleDownload}
      />

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir reserva de transfer?"
        description="Esta ação remove permanentemente a reserva do sistema. Deseja continuar?"
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />

      {comunicarDados && (
        <ComunicarDialog
          open={comunicarOpen}
          onOpenChange={setComunicarOpen}
          dados={comunicarDados}
          telefone={comunicarDados.telefone}
          titulo="Comunicar — Reserva Transfer"
          onGerarPDF={() => generateTransferPDF(comunicarDados.id)}
          webhookTipo="transfer_reserva"
          getConfirmacaoReservaPdfBase64={() => getTransferReservaPdfBase64(comunicarDados.id)}
        />
      )}
    </div>
  );
}
