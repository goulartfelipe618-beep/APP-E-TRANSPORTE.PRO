import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Download, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DetalhesSolicitacaoMotoristaSheet from "@/components/solicitacoes/DetalhesSolicitacaoMotoristaSheet";
import CadastrarMotoristaDialog from "@/components/motoristas/CadastrarMotoristaDialog";
import ComunicarDialog from "@/components/comunicar/ComunicarDialog";
import { generateSolicitacaoMotoristaPDF } from "@/lib/pdfGenerator";

interface Solicitacao {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string | null;
  cnh: string | null;
  cidade: string | null;
  mensagem: string | null;
  status: string;
  created_at: string;
}

export interface MotoristaInitialData {
  nome?: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  cnh?: string;
  cidade?: string;
  solicitacao_id?: string;
}

export default function MotoristaSolicitacoesPage() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Solicitacao | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialData, setInitialData] = useState<MotoristaInitialData | null>(null);
  const [comunicarOpen, setComunicarOpen] = useState(false);
  const [comunicarDados, setComunicarDados] = useState<Solicitacao | null>(null);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("solicitacoes_motoristas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar solicitações");
    else setSolicitacoes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVisualizar = (s: Solicitacao) => {
    setSelected(s);
    setSheetOpen(true);
  };

  const handleConverter = (s: Solicitacao) => {
    const data: MotoristaInitialData = {
      nome: s.nome,
      email: s.email || undefined,
      telefone: s.telefone || undefined,
      cpf: s.cpf || undefined,
      cnh: s.cnh || undefined,
      cidade: s.cidade || undefined,
      solicitacao_id: s.id,
    };
    setInitialData(data);
    setSheetOpen(false);
    setTimeout(() => setDialogOpen(true), 350);
  };

  const handleCadastrado = async () => {
    if (initialData?.solicitacao_id) {
      await supabase.from("solicitacoes_motoristas").update({ status: "cadastrado" }).eq("id", initialData.solicitacao_id);
    }
    setInitialData(null);
    fetchData();
  };

  const handleComunicar = (s: Solicitacao) => {
    setComunicarDados(s);
    setComunicarOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de Motoristas</h1>
          <p className="text-muted-foreground">Solicitações recebidas de pessoas que desejam ser motoristas parceiros ({solicitacoes.length})</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Exportar CSV</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-6">Carregando...</p>
        ) : solicitacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Nenhuma solicitação recebida.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>CNH</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitacoes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.nome}</TableCell>
                  <TableCell className="text-sm">{s.email || "—"}</TableCell>
                  <TableCell className="text-sm">{s.telefone || "—"}</TableCell>
                  <TableCell className="text-sm">{s.cpf || "—"}</TableCell>
                  <TableCell className="text-sm">{s.cnh || "—"}</TableCell>
                  <TableCell className="text-sm">{s.cidade || "—"}</TableCell>
                  <TableCell className="text-sm">{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleVisualizar(s)} title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleComunicar(s)} title="Comunicar">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <DetalhesSolicitacaoMotoristaSheet
        solicitacao={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onConverter={handleConverter}
        onComunicar={handleComunicar}
      />

      <CadastrarMotoristaDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setInitialData(null); }}
        onCreated={handleCadastrado}
        initialData={initialData}
      />

      {comunicarDados && (
        <ComunicarDialog
          open={comunicarOpen}
          onOpenChange={setComunicarOpen}
          dados={comunicarDados}
          telefone={comunicarDados.telefone}
          titulo="Comunicar — Solicitação de Motorista"
          onGerarPDF={() => generateSolicitacaoMotoristaPDF(comunicarDados)}
        />
      )}
    </div>
  );
}
