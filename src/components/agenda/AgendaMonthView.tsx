import { cn } from "@/lib/utils";
import { agendaItemCodigoNoPassado, type AgendaItem } from "@/lib/painelAgendaReservas";

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startWeekdayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

function weekdayLabel(year: number, monthIndex: number, dayNum: number): string {
  return WEEKDAYS_PT[new Date(year, monthIndex, dayNum).getDay()] ?? "";
}

function AgendaItemButton({
  it,
  stacked,
  onClick,
}: {
  it: AgendaItem;
  stacked: boolean;
  onClick: () => void;
}) {
  const noPassado = agendaItemCodigoNoPassado(it);
  const title = `${it.numeroLabel} · ${it.categoriaAbrev ? `${it.categoriaAbrev} · ` : ""}${it.perna} · ${it.horario} — ${it.trajetoResumo}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "w-full min-w-0 rounded-md border border-border/80 bg-muted/40 text-left text-foreground transition-colors hover:bg-muted/70",
        stacked
          ? "flex flex-col gap-1 px-2.5 py-2"
          : "flex min-w-0 items-center gap-0.5 px-1 py-0.5 text-[10px] leading-tight xl:text-[11px]",
      )}
    >
      <span className={cn("flex min-w-0 items-center gap-1", stacked ? "flex-wrap gap-1.5" : "min-w-0 flex-1 overflow-hidden")}>
        <span
          className={cn(
            "shrink-0 font-mono font-semibold tabular-nums",
            stacked ? "text-sm" : "",
            noPassado ? "text-red-500" : "text-green-500",
          )}
        >
          {it.numeroLabel}
        </span>
        {it.categoriaAbrev ? (
          <span
            className={cn(
              "shrink-0 rounded bg-[#FF6600] font-bold uppercase leading-none tracking-tight text-white",
              stacked ? "px-1.5 py-0.5 text-[10px]" : "px-1 py-px text-[9px]",
            )}
          >
            {it.categoriaAbrev}
          </span>
        ) : null}
        {(it.perna === "Ida" || it.perna === "Volta") && (
          <span
            className={cn(
              "shrink-0 font-bold uppercase leading-none text-[#FF6600]",
              stacked ? "text-xs" : "px-0.5 text-[9px]",
            )}
          >
            {it.perna}
          </span>
        )}
        <span className={cn("shrink-0 font-medium text-muted-foreground", stacked ? "text-xs" : "whitespace-nowrap text-[10px]")}>
          {it.horario}
        </span>
        {!stacked && it.trajetoResumo ? (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.trajetoResumo}</span>
        ) : null}
      </span>
      {stacked && it.trajetoResumo ? (
        <span className="min-w-0 break-words text-sm leading-snug text-muted-foreground">{it.trajetoResumo}</span>
      ) : null}
    </button>
  );
}

export function AgendaMonthView({
  year,
  monthIndex,
  todayKey,
  itemsByDay,
  onItemClick,
}: {
  year: number;
  monthIndex: number;
  todayKey: string;
  itemsByDay: Map<string, AgendaItem[]>;
  onItemClick: (item: AgendaItem) => void;
}) {
  const dim = daysInMonth(year, monthIndex);
  const startPad = startWeekdayOfMonth(year, monthIndex);
  const totalSlots = Math.ceil((startPad + dim) / 7) * 7;

  const mobileDays = Array.from({ length: dim }, (_, i) => {
    const dayNum = i + 1;
    const dayKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return { dayNum, dayKey, items: itemsByDay.get(dayKey) ?? [] };
  });

  return (
    <>
      <div className="space-y-3 lg:hidden">
        <div className="rounded-xl border border-border bg-card p-2">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS_PT.map((wd) => (
              <div key={wd} className="py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                {wd}
              </div>
            ))}
            {Array.from({ length: totalSlots }, (_, i) => {
              const dayNum = i - startPad + 1;
              if (dayNum < 1 || dayNum > dim) return <div key={`e-${i}`} />;
              const dayKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const count = itemsByDay.get(dayKey)?.length ?? 0;
              const isToday = todayKey === dayKey;
              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => {
                    document.getElementById(`agenda-dia-${dayKey}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "flex min-h-10 flex-col items-center justify-center rounded-md text-xs font-semibold",
                    isToday ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground",
                    count > 0 && !isToday && "ring-1 ring-[#FF6600]/70",
                    count === 0 && "opacity-60",
                  )}
                >
                  {dayNum}
                  {count > 0 ? (
                    <span className={cn("text-[9px] font-bold", isToday ? "text-primary-foreground/90" : "text-[#FF6600]")}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {mobileDays.map(({ dayNum, dayKey, items }) => {
            if (items.length === 0) return null;
            const isToday = todayKey === dayKey;
            return (
              <section
                key={dayKey}
                id={`agenda-dia-${dayKey}`}
                className={cn(
                  "scroll-mt-20 rounded-xl border p-3",
                  isToday ? "border-primary/60 bg-primary/5" : "border-border bg-card",
                )}
              >
                <header className="mb-2 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold",
                      isToday ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {dayNum}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {weekdayLabel(year, monthIndex, dayNum)}
                    {isToday ? " · Hoje" : ""}
                  </span>
                </header>
                <div className="flex flex-col gap-2">
                  {items.map((it) => (
                    <AgendaItemButton key={it.key} it={it} stacked onClick={() => onItemClick(it)} />
                  ))}
                </div>
              </section>
            );
          })}
          {mobileDays.every((d) => d.items.length === 0) ? (
            <p className="rounded-xl border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
              Sem reservas neste mês.
            </p>
          ) : null}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS_PT.map((wd) => (
            <div
              key={wd}
              className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: totalSlots }, (_, i) => {
            const dayNum = i - startPad + 1;
            const isPad = dayNum < 1 || dayNum > dim;
            const dayKey = isPad
              ? `pad-${i}`
              : `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const items = isPad ? [] : (itemsByDay.get(dayKey) ?? []);
            const isToday = !isPad && todayKey === dayKey;
            return (
              <div
                key={dayKey}
                className={cn(
                  "flex h-[11.5rem] min-w-0 flex-col border-b border-r border-border p-1.5",
                  i % 7 === 6 && "border-r-0",
                  i >= totalSlots - 7 && "border-b-0",
                  isPad && "bg-muted/15",
                  !isPad && "bg-background",
                  isToday && "bg-primary/5 ring-1 ring-inset ring-primary/50",
                )}
              >
                {!isPad ? (
                  <>
                    <span
                      className={cn(
                        "mb-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                        isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                      )}
                    >
                      {dayNum}
                    </span>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                      {items.map((it) => (
                        <AgendaItemButton key={it.key} it={it} stacked={false} onClick={() => onItemClick(it)} />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
