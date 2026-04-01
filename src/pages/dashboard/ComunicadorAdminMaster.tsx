import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Comunicadores (oficial + motoristas) são operados via n8n / backend.
 * Não há criação nem configuração de Evolution neste painel.
 */
export default function ComunicadorAdminMasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comunicador</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Os canais de WhatsApp — linha oficial da plataforma e conexões dos motoristas executivos — são integrados via{" "}
          <strong className="text-foreground">n8n</strong> e serviços configurados fora deste painel.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Sem configuração neste painel</CardTitle>
          <CardDescription>
            Não é possível gerar, conectar ou editar comunicadores aqui. Instâncias, credenciais e fluxos de mensagens são
            tratados no n8n e no backend, não pelo administrador nesta tela.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Cada motorista executivo pode conectar <strong className="text-foreground">apenas um</strong> comunicador
            próprio no painel dele. Ao usar <strong className="text-foreground">Comunicar</strong> nas reservas e
            solicitações, ele escolhe enviar pela <strong className="text-foreground">linha oficial da plataforma</strong>{" "}
            ou pelo <strong className="text-foreground">próprio WhatsApp</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
