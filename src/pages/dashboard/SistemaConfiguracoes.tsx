import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, User, Upload, Save, Key, Shield, RefreshCw, Type, Pencil, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";

const FONT_OPTIONS = [
  { value: "montserrat", label: "Montserrat" },
  { value: "inter", label: "Inter" },
  { value: "roboto", label: "Roboto" },
  { value: "opensans", label: "Open Sans" },
  { value: "lato", label: "Lato" },
  { value: "poppins", label: "Poppins" },
];

export default function SistemaConfiguracoesPage() {
  const { config, refreshConfig } = useConfiguracoes();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoContratualRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profileEditing, setProfileEditing] = useState(true);
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [enderecoCompleto, setEnderecoCompleto] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpjPerfil, setCnpjPerfil] = useState("");

  // Global
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [fonteGlobal, setFonteGlobal] = useState("montserrat");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Informações Contratuais
  const [contratualEditing, setContratualEditing] = useState(true);
  const [contratualSaved, setContratualSaved] = useState(false);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [enderecoSede, setEnderecoSede] = useState("");
  const [representanteLegal, setRepresentanteLegal] = useState("");
  const [logoContratualUrl, setLogoContratualUrl] = useState("");
  const [telefoneContratual, setTelefoneContratual] = useState("");
  const [whatsappContratual, setWhatsappContratual] = useState("");
  const [emailOficial, setEmailOficial] = useState("");
  const [uploadingLogoContratual, setUploadingLogoContratual] = useState("");

  useEffect(() => {
    loadSettings();
    loadContratual();
  }, []);

  const loadContratual = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("cabecalho_contratual" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setRazaoSocial(d.razao_social || "");
      setCnpj(d.cnpj || "");
      setEnderecoSede(d.endereco_sede || "");
      setRepresentanteLegal(d.representante_legal || "");
      setLogoContratualUrl(d.logo_contratual_url || "");
      setTelefoneContratual(d.telefone || "");
      setWhatsappContratual(d.whatsapp || "");
      setEmailOficial(d.email_oficial || "");
      setContratualEditing(false);
      setContratualSaved(true);
    }
  };

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("configuracoes" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const d = data as any;
      setNomeCompleto(d.nome_completo || "");
      setTelefone(d.telefone || "");
      setEmail(d.email || "");
      setNomeProjeto(d.nome_projeto || "E-Transporte.pro");
      setFonteGlobal(d.fonte_global || "montserrat");
      setLogoUrl(d.logo_url || "");
      if (d.nome_completo || d.telefone || d.email) {
        setProfileEditing(false);
      }
    } else {
      setNomeProjeto("E-Transporte.pro");
      setProfileEditing(true);
    }
  };

  const upsertField = async (fields: Record<string, any>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); return false; }

    // Check if exists
    const { data: existing } = await supabase
      .from("configuracoes" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("configuracoes" as any)
        .update({ ...fields, updated_at: new Date().toISOString() } as any)
        .eq("user_id", user.id);
      if (error) { toast.error("Erro ao salvar"); return false; }
    } else {
      const { error } = await supabase
        .from("configuracoes" as any)
        .insert({ user_id: user.id, ...fields } as any);
      if (error) { toast.error("Erro ao salvar"); return false; }
    }
    return true;
  };

  const handleSaveProfile = async () => {
    const ok = await upsertField({ nome_completo: nomeCompleto, telefone, email });
    if (ok) {
      toast.success("Perfil salvo");
      setProfileEditing(false);
    }
  };

  const handleSaveNomeProjeto = async () => {
    const ok = await upsertField({ nome_projeto: nomeProjeto });
    if (ok) { toast.success("Nome do projeto salvo"); await refreshConfig(); }
  };

  const handleSaveFonte = async () => {
    const ok = await upsertField({ fonte_global: fonteGlobal });
    if (ok) { toast.success("Fonte global salva"); await refreshConfig(); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setUploading(false); return; }

    const filePath = `${user.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
    if (upErr) { toast.error("Erro no upload"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    const ok = await upsertField({ logo_url: publicUrl });
    if (ok) {
      setLogoUrl(publicUrl);
      toast.success("Logomarca atualizada");
      await refreshConfig();
    }
    setUploading(false);
  };

  const handleSaveContratual = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); return; }

    const payload = {
      user_id: user.id,
      nome: "Cabeçalho 1",
      razao_social: razaoSocial,
      cnpj,
      endereco_sede: enderecoSede,
      representante_legal: representanteLegal,
      logo_contratual_url: logoContratualUrl,
      telefone: telefoneContratual,
      whatsapp: whatsappContratual,
      email_oficial: emailOficial,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("cabecalho_contratual" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase.from("cabecalho_contratual" as any).update(payload as any).eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("cabecalho_contratual" as any).insert(payload as any));
    }

    if (error) { toast.error("Erro ao salvar informações contratuais"); return; }
    toast.success("Cabeçalho 1 salvo com sucesso");
    setContratualEditing(false);
    setContratualSaved(true);
  };

  const handleLogoContratualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogoContratual("uploading");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Não autenticado"); setUploadingLogoContratual(""); return; }

    const filePath = `${user.id}/logo-contratual-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(filePath, file, { upsert: true });
    if (upErr) { toast.error("Erro no upload"); setUploadingLogoContratual(""); return; }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    setLogoContratualUrl(urlData.publicUrl);
    toast.success("Logotipo contratual enviado");
    setUploadingLogoContratual("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      {/* Meu Perfil */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-foreground" />
            <h3 className="font-semibold text-foreground">Meu Perfil</h3>
          </div>
          {!profileEditing && (
            <Button variant="outline" size="sm" onClick={() => setProfileEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-6">Seus dados pessoais de cadastro</p>

        <div className={`space-y-4 ${!profileEditing ? "opacity-60 pointer-events-none" : ""}`}>
          <div>
            <label className="text-sm font-medium text-foreground">Nome Completo *</label>
            <Input
              placeholder="Seu nome completo"
              className="mt-1"
              value={nomeCompleto}
              onChange={e => setNomeCompleto(e.target.value)}
              disabled={!profileEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Telefone *</label>
            <Input
              placeholder="(00) 00000-0000"
              className="mt-1"
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              disabled={!profileEditing}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">E-mail *</label>
            <Input
              placeholder="seu@email.com"
              className="mt-1"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={!profileEditing}
            />
          </div>
        </div>
        {profileEditing && (
          <Button className="bg-primary text-primary-foreground mt-4" onClick={handleSaveProfile}>
            <Save className="h-4 w-4 mr-2" /> Salvar Perfil
          </Button>
        )}
      </div>

      {/* Logomarca Global */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Car className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Logomarca Global</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altera a logomarca em todo o sistema (painel, contratos, etc.)</p>

        <div className="bg-muted/30 rounded-lg p-8 flex items-center justify-center mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-16 max-w-[200px] object-contain" />
          ) : (
            <Car className="h-16 w-16 text-foreground" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoUpload}
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="h-4 w-4 mr-2" /> {uploading ? "Enviando..." : "Enviar Logomarca"}
        </Button>
      </div>

      {/* Nome do Projeto */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Nome do Projeto</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altera o nome exibido em todo o sistema (painel, contratos, etc.)</p>
        <Input value={nomeProjeto} onChange={e => setNomeProjeto(e.target.value)} className="mb-3" />
        <Button className="bg-primary text-primary-foreground" onClick={handleSaveNomeProjeto}>
          <Save className="h-4 w-4 mr-2" /> Salvar
        </Button>
      </div>

      {/* Fonte Global */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Fonte Global</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altera a fonte de todo o sistema, inclusive contratos</p>
        <Select value={fonteGlobal} onValueChange={setFonteGlobal}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-2" style={{ fontFamily: FONT_OPTIONS.find(f => f.value === fonteGlobal)?.label }}>
          Exemplo de texto com a fonte <strong>{FONT_OPTIONS.find(f => f.value === fonteGlobal)?.label}</strong>
        </p>
        <Button className="bg-primary text-primary-foreground mt-3" onClick={handleSaveFonte}>
          <Save className="h-4 w-4 mr-2" /> Salvar
        </Button>
      </div>


      {/* Informações Contratuais */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-foreground" />
            <h3 className="font-semibold text-foreground">Informações Contratuais</h3>
          </div>
          {contratualSaved && !contratualEditing && (
            <Button variant="outline" size="sm" onClick={() => setContratualEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          {contratualSaved ? "Cabeçalho 1" : "Preencha os dados de identificação do motorista/empresa para contratos"}
        </p>

        <div className={`space-y-4 ${!contratualEditing ? "opacity-60 pointer-events-none" : ""}`}>
          <div>
            <label className="text-sm font-medium text-foreground">Nome Empresarial / Razão Social (igual ao CNPJ) *</label>
            <Input className="mt-1" placeholder="Razão Social conforme CNPJ" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} disabled={!contratualEditing} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">CNPJ *</label>
            <Input className="mt-1" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} disabled={!contratualEditing} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Endereço da Sede *</label>
            <Input className="mt-1" placeholder="Rua, número, bairro, cidade - UF" value={enderecoSede} onChange={e => setEnderecoSede(e.target.value)} disabled={!contratualEditing} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Representante Legal (se houver)</label>
            <Input className="mt-1" placeholder="Nome do representante legal" value={representanteLegal} onChange={e => setRepresentanteLegal(e.target.value)} disabled={!contratualEditing} />
          </div>

          {/* Logotipo Contratual */}
          <div>
            <label className="text-sm font-medium text-foreground">Logotipo Contratual (fundo branco)</label>
            <div className="bg-muted/30 rounded-lg p-6 flex items-center justify-center mt-1 mb-2 border border-dashed border-border">
              {logoContratualUrl ? (
                <img src={logoContratualUrl} alt="Logo Contratual" className="h-14 max-w-[180px] object-contain" />
              ) : (
                <FileText className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <input ref={logoContratualRef} type="file" accept="image/*" className="hidden" onChange={handleLogoContratualUpload} />
            {contratualEditing && (
              <Button variant="outline" size="sm" onClick={() => logoContratualRef.current?.click()} disabled={!!uploadingLogoContratual}>
                <Upload className="h-4 w-4 mr-2" /> {uploadingLogoContratual ? "Enviando..." : "Enviar Logotipo"}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Telefone *</label>
              <Input className="mt-1" placeholder="(00) 0000-0000" value={telefoneContratual} onChange={e => setTelefoneContratual(e.target.value)} disabled={!contratualEditing} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">WhatsApp *</label>
              <Input className="mt-1" placeholder="(00) 00000-0000" value={whatsappContratual} onChange={e => setWhatsappContratual(e.target.value)} disabled={!contratualEditing} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">E-mail Oficial *</label>
            <Input className="mt-1" placeholder="contato@empresa.com" value={emailOficial} onChange={e => setEmailOficial(e.target.value)} disabled={!contratualEditing} />
          </div>
        </div>

        {contratualEditing && (
          <Button className="bg-primary text-primary-foreground mt-4" onClick={handleSaveContratual}>
            <Save className="h-4 w-4 mr-2" /> Salvar Cabeçalho 1
          </Button>
        )}
      </div>

      {/* Segurança */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Segurança</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Altere sua senha e configure autenticação em dois fatores</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Alteração de Senha</p>
              <p className="text-sm text-muted-foreground">Alterar a senha de acesso</p>
            </div>
            <Button variant="outline" size="sm"><Key className="h-4 w-4 mr-2" /> Alterar</Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Autenticação em 2 Fatores (2FA)</p>
              <p className="text-sm text-muted-foreground">Camada extra de segurança via app autenticador (TOTP)</p>
            </div>
            <Button variant="outline" size="sm"><Shield className="h-4 w-4 mr-2" /> Configurar</Button>
          </div>
        </div>
      </div>

      {/* Hard Refresh */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Hard Refresh</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Recarregar o sistema completamente</p>
        <Button variant="destructive" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Recarregar Sistema
        </Button>
      </div>
    </div>
  );
}
