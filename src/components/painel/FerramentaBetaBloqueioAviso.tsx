import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { FERRAMENTA_BETA_MSG_LINHA1, FERRAMENTA_BETA_MSG_LINHA2 } from "@/lib/ferramentasPlataformaMensagens";

export default function FerramentaBetaBloqueioAviso() {
  return (
    <Card className="border-amber-500/60 bg-amber-500/10 shadow-sm">
      <CardContent className="flex gap-3 p-4 sm:p-5">
        <Construction className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
        <div className="min-w-0 space-y-3 text-sm leading-relaxed text-foreground">
          <p className="font-semibold tracking-wide">{FERRAMENTA_BETA_MSG_LINHA1}</p>
          <p className="font-medium text-foreground/95">{FERRAMENTA_BETA_MSG_LINHA2}</p>
        </div>
      </CardContent>
    </Card>
  );
}
