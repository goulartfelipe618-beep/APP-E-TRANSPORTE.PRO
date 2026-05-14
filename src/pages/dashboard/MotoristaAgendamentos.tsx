import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function MotoristaAgendamentosPage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance text-xl font-bold text-foreground sm:text-2xl">Agendamentos de Motoristas</h1>
          <p className="text-pretty text-sm text-muted-foreground sm:text-base">
            Gerenciar reuniões e compromissos com motoristas
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="outline" className="min-h-10 w-full justify-center gap-2 sm:w-auto sm:min-h-9">
            <RefreshCw className="h-4 w-4 shrink-0" /> Atualizar
          </Button>
          <Button className="min-h-10 w-full justify-center gap-2 bg-primary text-primary-foreground sm:w-auto sm:min-h-9">
            <Plus className="h-4 w-4 shrink-0" /> Novo Agendamento
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <p className="text-center text-sm text-muted-foreground">Nenhum agendamento encontrado</p>
      </div>

      <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground sm:text-xl">Calendário</h2>
            <p className="text-sm text-muted-foreground">Visualização mensal dos agendamentos</p>
          </div>
          <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-end">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 sm:h-9 sm:w-9" onClick={prevMonth} aria-label="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-0 truncate px-1 text-center text-sm font-medium text-foreground sm:text-base">
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 sm:h-9 sm:w-9" onClick={nextMonth} aria-label="Mês seguinte">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto overscroll-x-contain rounded-lg border border-border">
          <div className="grid min-w-[280px] grid-cols-7 overflow-hidden">
            {DAYS.map((d) => (
              <div
                key={d}
                className="border-b border-border bg-muted/30 p-1 text-center text-[10px] font-medium text-muted-foreground sm:p-2 sm:text-xs"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: totalCells }).map((_, i) => {
              const day = i - firstDay + 1;
              const isValid = day >= 1 && day <= daysInMonth;
              const isToday =
                isValid &&
                day === today.getDate() &&
                currentMonth === today.getMonth() &&
                currentYear === today.getFullYear();
              const isSunday = i % 7 === 0;

              return (
                <div
                  key={i}
                  className={`min-h-[52px] border-b border-r border-border p-1 sm:min-h-[60px] sm:p-2 ${!isValid ? "bg-muted/20" : ""}`}
                >
                  {isValid && (
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center text-xs sm:h-8 sm:w-8 sm:text-sm ${
                        isToday
                          ? "rounded-full bg-primary text-primary-foreground"
                          : isSunday
                            ? "text-destructive"
                            : "text-foreground"
                      }`}
                    >
                      {day}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 shrink-0 rounded-full bg-primary" />
            <span className="text-muted-foreground">Agendado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 shrink-0 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Concluído</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 shrink-0 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Cancelado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
