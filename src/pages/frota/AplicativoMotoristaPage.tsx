import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lembrarTokenAplicativoMotorista, tokenDoTextoDeAcesso } from "@/lib/capacitorFrota";
import { toast } from "sonner";

/**
 * Primeira tela do aplicativo do motorista.
 * Cada motorista tem um link exclusivo; o app não tem login de admin.
 */
export default function AplicativoMotoristaPage() {
  const navigate = useNavigate();
  const [link, setLink] = useState("");

  const continuar = () => {
    const token = tokenDoTextoDeAcesso(link);
    if (!token) {
      toast.error("Cole o link exclusivo do motorista, ou só o código que vem no fim dele.");
      return;
    }
    lembrarTokenAplicativoMotorista(token);
    navigate(`/frota/acesso/${token}`, { replace: true });
  };

  return (
    <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-muted/30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">E-TRANSPORTE Motorista</CardTitle>
          <p className="text-sm text-muted-foreground">
            Este aplicativo é o mini painel do motorista. Cole o link que o administrador da frota enviou. O login do painel administrativo não entra aqui.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              continuar();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="link-motorista">Link exclusivo</Label>
              <Input
                id="link-motorista"
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://…/frota/acesso/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="min-h-11"
              />
            </div>
            <Button type="submit" className="min-h-11 w-full bg-primary text-primary-foreground">
              Continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
