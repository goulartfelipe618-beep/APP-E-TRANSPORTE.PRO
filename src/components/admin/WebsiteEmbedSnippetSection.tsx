import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Monitor, Copy, Check, Code2 } from "lucide-react";
import { toast } from "sonner";
import { buildWordPressWebsiteEmbedSnippet } from "@/lib/websiteEmbedApi";
import { useState } from "react";

export default function WebsiteEmbedSnippetSection() {
  const [copied, setCopied] = useState(false);
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://e-transporte.pro";
  const snippet = useMemo(() => buildWordPressWebsiteEmbedSnippet(appOrigin), [appOrigin]);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("Snippet copiado!");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  return (
    <div className="rounded-xl border border-[#FF6600]/35 bg-card p-6 max-w-2xl">
      <div className="flex items-start gap-3 mb-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF6600]/15">
          <Monitor className="h-5 w-5 text-[#FF6600]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">Snippet WordPress — Templates de Website</h3>
            <span className="inline-flex items-center rounded bg-[#FF6600]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF6600]">
              Admin Master
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cole este código num widget <strong className="text-foreground">HTML</strong> do WordPress. Os templates
            cadastrados em <strong className="text-foreground">Templates</strong> aparecerão com o mesmo visual do painel
            do motorista, incluindo efeito de rolagem ao passar o mouse, layout responsivo e formulário de briefing{" "}
            <strong className="text-foreground">sem exigir domínio</strong>.
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="absolute top-2 right-2 z-10">
          <Button type="button" size="sm" variant="secondary" className="gap-1.5 h-8" onClick={() => void copySnippet()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <Textarea
          readOnly
          value={snippet}
          className="font-mono text-xs min-h-[120px] pr-24 bg-muted/40"
          aria-label="Snippet HTML para WordPress"
        />
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
        <li>
          Pré-visualização interna:{" "}
          <a
            href="/embed/website"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6600] hover:underline font-medium"
          >
            abrir página embed
          </a>
        </li>
        <li>Os briefings enviados pelo WordPress aparecem em <strong className="text-foreground">Solicitações Serviços</strong>.</li>
        <li>
          <Code2 className="inline h-3 w-3 mr-0.5 align-text-bottom" />
          Não altera o fluxo do painel Motorista Executivo (domínio continua obrigatório lá).
        </li>
      </ul>
    </div>
  );
}
