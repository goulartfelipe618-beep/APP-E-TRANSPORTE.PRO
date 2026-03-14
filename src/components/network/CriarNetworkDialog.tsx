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
import { Building2, User, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const CATEGORIAS = [
  "Agências de Viagens",
  "Clínicas e Hospitais",
  "Embaixadas e Consulados",
  "Empresas de Casamento",
  "Hotéis e Resorts",
  "Laboratórios e Farmácias",
  "Órgãos Governamentais",
  "Produtores de Shows",
];

const TIPOS_EMPRESA = ["Matriz", "Filial", "Franquia", "Representante"];

const ESTADOS_UF = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const STATUS_CONTATO = [
  "Prospect (Frio)", "Prospect (Morno)", "Prospect (Quente)",
  "Cliente Ativo", "Cliente Inativo",
];

const POTENCIAL_NEGOCIO = ["Baixo", "Médio", "Alto"];

const initialForm = {
  nomeEmpresa: "", categoria: "", cnpj: "", tipoEmpresa: "",
  endereco: "", estado: "", cidade: "", website: "",
  nomeContato: "", cargoFuncao: "", telefoneDireto: "", emailCorporativo: "",
  statusContato: "Prospect (Frio)", potencialNegocio: "Médio",
  responsavel: "", observacoes: "",
};

export default function CriarNetworkDialog({ open, onOpenChange, onSaved }: Props) {
  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!formData.nomeEmpresa || !formData.categoria) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setSaving(false); return; }

    const { error } = await supabase.from("network" as any).insert({
      user_id: user.id,
      nome_empresa: formData.nomeEmpresa,
      categoria: formData.categoria,
      cnpj: formData.cnpj,
      tipo_empresa: formData.tipoEmpresa,
      endereco: formData.endereco,
      estado: formData.estado,
      cidade: formData.cidade,
      website: formData.website,
      nome_contato: formData.nomeContato,
      cargo_funcao: formData.cargoFuncao,
      telefone_direto: formData.telefoneDireto,
      email_corporativo: formData.emailCorporativo,
      status_contato: formData.statusContato,
      potencial_negocio: formData.potencialNegocio,
      responsavel: formData.responsavel,
      observacoes: formData.observacoes,
    } as any);

    setSaving(false);
    if (error) { toast.error("Erro ao cadastrar: " + error.message); return; }

    toast.success("Empresa cadastrada com sucesso!");
    setFormData(initialForm);
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Novo Contato Network</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" /> Identificação da Empresa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome da Empresa *</label>
              <Input value={formData.nomeEmpresa} onChange={(e) => update("nomeEmpresa", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Categoria *</label>
              <Select value={formData.categoria} onValueChange={(v) => update("categoria", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">CNPJ</label>
              <Input placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={(e) => update("cnpj", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Tipo de Empresa</label>
              <Select value={formData.tipoEmpresa} onValueChange={(v) => update("tipoEmpresa", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_EMPRESA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Endereço Completo</label>
            <Input placeholder="Digite o endereço..." value={formData.endereco} onChange={(e) => update("endereco", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Estado (UF)</label>
              <Select value={formData.estado} onValueChange={(v) => update("estado", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_UF.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Cidade</label>
              <Input value={formData.cidade} onChange={(e) => update("cidade", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Website</label>
            <Input placeholder="https://" value={formData.website} onChange={(e) => update("website", e.target.value)} />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <User className="h-4 w-4" /> Contato Principal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome do Contato</label>
              <Input value={formData.nomeContato} onChange={(e) => update("nomeContato", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Cargo/Função</label>
              <Input placeholder="Ex: Gerente de Compras" value={formData.cargoFuncao} onChange={(e) => update("cargoFuncao", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Telefone Direto</label>
              <Input value={formData.telefoneDireto} onChange={(e) => update("telefoneDireto", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">E-mail Corporativo *</label>
              <Input type="email" value={formData.emailCorporativo} onChange={(e) => update("emailCorporativo", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" /> Classificação e Segmentação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Status do Contato</label>
              <Select value={formData.statusContato} onValueChange={(v) => update("statusContato", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_CONTATO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Potencial de Negócio</label>
              <Select value={formData.potencialNegocio} onValueChange={(v) => update("potencialNegocio", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POTENCIAL_NEGOCIO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Responsável</label>
              <Input value={formData.responsavel} onChange={(e) => update("responsavel", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Observações</label>
            <Textarea
              placeholder="Registre interações, necessidades específicas, etc."
              value={formData.observacoes}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
