import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, User, Upload, Save, Key, Shield, RefreshCw, Type } from "lucide-react";

export default function SistemaConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      {/* Meu Perfil */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Meu Perfil</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Seus dados pessoais de cadastro</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Nome Completo *</label>
            <Input placeholder="Seu nome completo" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Telefone *</label>
            <Input placeholder="(00) 00000-0000" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">E-mail *</label>
            <Input placeholder="seu@email.com" className="mt-1" />
          </div>
          <Button className="bg-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-2" /> Salvar Perfil
          </Button>
        </div>
      </div>

      {/* Logomarca Global */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Car className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Logomarca Global</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Upload da logomarca utilizada em todo o sistema</p>

        <div className="bg-muted/30 rounded-lg p-8 flex items-center justify-center mb-4">
          <Car className="h-16 w-16 text-foreground" />
        </div>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" /> Enviar Logomarca
        </Button>
      </div>

      {/* Nome do Projeto */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Nome do Projeto</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Nome global exibido no sistema</p>
        <Input defaultValue="E-Transporte.pro" className="mb-3" />
        <Button className="bg-primary text-primary-foreground">
          <Save className="h-4 w-4 mr-2" /> Salvar
        </Button>
      </div>

      {/* Fonte Global */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Type className="h-5 w-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Fonte Global</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Fonte utilizada em toda a interface</p>
        <Select defaultValue="montserrat">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="montserrat">Montserrat</SelectItem>
            <SelectItem value="inter">Inter</SelectItem>
            <SelectItem value="roboto">Roboto</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-2">Exemplo de texto com a fonte <strong>Montserrat</strong></p>
        <Button className="bg-primary text-primary-foreground mt-3">
          <Save className="h-4 w-4 mr-2" /> Salvar
        </Button>
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
            <Button variant="outline" size="sm">
              <Key className="h-4 w-4 mr-2" /> Alterar
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium text-foreground">Autenticação em 2 Fatores (2FA)</p>
              <p className="text-sm text-muted-foreground">Camada extra de segurança via app autenticador (TOTP)</p>
            </div>
            <Button variant="outline" size="sm">
              <Shield className="h-4 w-4 mr-2" /> Configurar
            </Button>
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
        <Button variant="destructive">
          <RefreshCw className="h-4 w-4 mr-2" /> Recarregar Sistema
        </Button>
      </div>
    </div>
  );
}
