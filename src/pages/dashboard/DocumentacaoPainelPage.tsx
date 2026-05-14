import { Fragment, useMemo } from "react";
import { Library, ShieldCheck, ListTree, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DOC_PAINEL_LEITURA_OBRIGATORIA,
  DOC_PAINEL_SECOES,
  type DocBlock,
} from "@/lib/documentacaoPainelConteudo";
import { useActivePage } from "@/contexts/ActivePageContext";

function renderRichText(text: string) {
  const segments = text.split(/(\*\*.+?\*\*)/g);
  return segments.map((seg, i) => {
    const m = seg.match(/^\*\*(.+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {m[1]}
        </strong>
      );
    }
    return <Fragment key={i}>{seg}</Fragment>;
  });
}

function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="min-w-0 space-y-4 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((b, idx) => {
        if (b.t === "p") {
          return (
            <p key={idx} className="text-pretty">
              {renderRichText(b.text)}
            </p>
          );
        }
        if (b.t === "h3") {
          return (
            <h3 key={idx} className="text-base font-semibold text-foreground">
              {b.text}
            </h3>
          );
        }
        if (b.t === "ul") {
          return (
            <ul key={idx} className="ml-4 list-disc space-y-2 marker:text-primary">
              {b.items.map((item, j) => (
                <li key={j} className="text-pretty pl-1">
                  {renderRichText(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (b.t === "ol") {
          return (
            <ol key={idx} className="ml-4 list-decimal space-y-2 marker:text-primary">
              {b.items.map((item, j) => (
                <li key={j} className="text-pretty pl-1">
                  {renderRichText(item)}
                </li>
              ))}
            </ol>
          );
        }
        const variant =
          b.variant === "security"
            ? "border-[#FF6600]/40 bg-[#FF6600]/5"
            : b.variant === "warning"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-primary/30 bg-muted/40";
        return (
          <Alert key={idx} className={cn("text-foreground", variant)}>
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle>{b.title}</AlertTitle>
            <AlertDescription className="text-muted-foreground">{renderRichText(b.body)}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}

const PAGE_ALIASES: { label: string; page: string }[] = [
  { label: "Configurações (Sistema)", page: "sistema/configuracoes" },
  { label: "Planos", page: "planos" },
  { label: "Home", page: "home" },
  { label: "Tickets", page: "tickets" },
];

export default function DocumentacaoPainelPage() {
  const { setActivePage } = useActivePage();

  const toc = useMemo(
    () =>
      DOC_PAINEL_SECOES.flatMap((sec) =>
        sec.chunks.map((ch) => ({
          sectionTitle: sec.title,
          id: `${sec.id}__${ch.id}`,
          title: ch.title,
        })),
      ),
    [],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Library className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Documentação do painel Motorista Executivo
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
                Manual de operações, vocabulário técnico e heurísticas de navegação exclusivas do painel{" "}
                <strong className="text-foreground">admin_transfer</strong> (Gestão de Frota). Não documenta o painel
                administrativo global.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PAGE_ALIASES.map((p) => (
              <Button
                key={p.page}
                type="button"
                variant="outline"
                size="sm"
                className="border-border text-foreground"
                onClick={() => setActivePage(p.page)}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <DocBlocks blocks={DOC_PAINEL_LEITURA_OBRIGATORIA} />
      </div>

      <details className="group rounded-xl border border-border bg-card/80 lg:hidden">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Índice remissivo (tocar para expandir)
            <ListTree className="h-4 w-4 shrink-0 text-primary" />
          </span>
        </summary>
        <div className="border-t border-border px-2 pb-3">
          <ScrollArea className="h-64">
            <nav className="space-y-1 p-2 text-xs">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                >
                  <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/80">
                    {item.sectionTitle}
                  </span>
                  <span className="font-medium text-foreground/90">{item.title}</span>
                </a>
              ))}
            </nav>
          </ScrollArea>
        </div>
      </details>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          {DOC_PAINEL_SECOES.map((sec) => (
            <section key={sec.id} className="scroll-mt-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <ListTree className="h-5 w-5 text-primary" />
                <h2 id={sec.id} className="text-xl font-bold text-foreground">
                  {sec.title}
                </h2>
              </div>
              {sec.chunks.map((chunk) => (
                <Card
                  key={chunk.id}
                  id={`${sec.id}__${chunk.id}`}
                  className="scroll-mt-24 border-border bg-card shadow-sm"
                >
                  <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-lg text-foreground">{chunk.title}</CardTitle>
                    <CardDescription className="text-xs font-mono text-muted-foreground">
                      id: {sec.id}__{chunk.id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DocBlocks blocks={chunk.blocks} />
                  </CardContent>
                </Card>
              ))}
            </section>
          ))}
        </div>

        <aside className="hidden min-w-0 lg:block">
          <div className="sticky top-4 space-y-3">
            <Card className="border-border bg-card/95 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">Índice remissivo</CardTitle>
                <CardDescription className="text-xs">
                  Navegação intra-documental; não substitui a sidebar principal.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[min(70vh,36rem)] pr-3">
                  <nav className="space-y-1 px-4 pb-4 text-xs">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className="block rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      >
                        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground/80">
                          {item.sectionTitle}
                        </span>
                        <span className="font-medium text-foreground/90">{item.title}</span>
                      </a>
                    ))}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
            <Separator />
            <p className="text-[11px] leading-snug text-muted-foreground">
              Versão textual compilada no *bundle* front-end. Alterações ao produto podem preceder a actualização deste
              manual — valide comportamentos críticos em ambiente de homologação sempre que possível.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
