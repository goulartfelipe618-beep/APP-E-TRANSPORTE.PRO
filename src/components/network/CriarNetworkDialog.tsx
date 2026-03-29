import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Route, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

const TIPOS_OPORTUNIDADE = [
  "Repasse de viagem / solicitação",
  "Busco parceiro na região",
  "Outro",
];

const URGENCIA = ["Baixa", "Média", "Alta"] as const;

const ESTADOS_UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const initialForm = {
  titulo: "",
  tipo: "",
  cidade: "",
  estado: "",
  rotaOuLocal: "",
  descricao: "",
  nomeContato: "",
  telefone: "",
  email: "",
  urgencia: "Média" as (typeof URGENCIA)[number],
};

export default function CriarNetworkDialog({ open, onOpenChange, onSaved }: Props) {
  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.titulo.trim() || !formData.tipo || !formData.descricao.trim()) {
      toast.error("Preencha título, tipo e descrição da oportunidade");
      return;
    }
    if (!formData.cidade.trim() || !formData.estado) {
      toast.error("Informe cidade e estado da região da viagem");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Não autenticado");
      setSaving(false);
      return;
    }

    const { data: perfil } = await supabase
      .from("configuracoes")
      .select("nome_completo, nome_empresa")
      .eq("user_id", user.id)
      .maybeSingle();

    const perf = perfil as { nome_completo: string | null; nome_empresa: string | null } | null;
    const autorNome =
      (perf?.nome_completo && perf.nome_completo.trim()) ||
      (perf?.nome_empresa && perf.nome_empresa.trim()) ||
      user.email?.split("@")[0] ||
      "Motorista";
    const autorEmail = user.email ?? "";

    const { error } = await supabase.from("network").insert({
      user_id: user.id,
      nome_empresa: formData.titulo.trim(),
      categoria: formData.tipo,
      cidade: formData.cidade.trim(),
      estado: formData.estado,
      endereco: formData.rotaOuLocal.trim() || null,
      observacoes: formData.descricao.trim(),
      nome_contato: formData.nomeContato.trim() || null,
      telefone_direto: formData.telefone.trim() || null,
      email_corporativo: formData.email.trim() || null,
      status_contato: "Aberto",
      potencial_negocio: formData.urgencia,
      autor_nome: autorNome,
      autor_email: autorEmail,
    });

    setSaving(false);
    if (error) {
      toast.error("Erro ao publicar: " + error.message);
      return;
    }

    toast.success("Publicação enviada! Todos os motoristas do Network podem ver.");
    setFormData(initialForm);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Nova oportunidade no Network
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            Compartilhe viagens ou pedidos de parceria para outros motoristas da plataforma — por exemplo, repasse
            em outra cidade ou estado.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Título da publicação *</label>
            <Input
              placeholder="Ex.: Repasse GRU → hotel em São Paulo"
              value={formData.titulo}
              onChange={(e) => update("titulo", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Tipo *</label>
            <Select value={formData.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TIPOS_OPORTUNIDADE.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Cidade (região) *</label>
              <Input
                placeholder="Ex.: São Paulo"
                value={formData.cidade}
                onChange={(e) => update("cidade", e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">UF *</label>
              <Select value={formData.estado} onValueChange={(v) => update("estado", v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_UF.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Rota ou local (opcional)</label>
            <Input
              placeholder="Ex.: Aeroporto de Guarulhos → Av. Paulista, 1000"
              value={formData.rotaOuLocal}
              onChange={(e) => update("rotaOuLocal", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Descrição *</label>
            <Textarea
              placeholder="Detalhes da viagem, horário, tipo de veículo, contato do cliente (se aplicável)…"
              value={formData.descricao}
              onChange={(e) => update("descricao", e.target.value)}
              rows={5}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Urgência</label>
            <Select value={formData.urgencia} onValueChange={(v) => update("urgencia", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {URGENCIA.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-medium text-foreground">Contato para retorno (opcional)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Nome"
                value={formData.nomeContato}
                onChange={(e) => update("nomeContato", e.target.value)}
              />
              <Input
                placeholder="WhatsApp / telefone"
                value={formData.telefone}
                onChange={(e) => update("telefone", e.target.value)}
              />
            </div>
            <Input
              type="email"
              placeholder="E-mail"
              value={formData.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
