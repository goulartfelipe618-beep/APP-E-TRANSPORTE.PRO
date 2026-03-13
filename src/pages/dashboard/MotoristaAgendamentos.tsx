import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agendamentos de Motoristas</h1>
          <p className="text-muted-foreground">Gerenciar reuniões e compromissos com motoristas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-center text-muted-foreground">Nenhum agendamento encontrado</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Calendário</h2>
            <p className="text-sm text-muted-foreground">Visualização mensal dos agendamentos</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-foreground">{MONTHS[currentMonth]} {currentYear}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden">
          {DAYS.map((d) => (
            <div key={d} className="p-3 text-center text-sm font-medium text-muted-foreground border-b border-border bg-muted/30">
              {d}
            </div>
          ))}
          {Array.from({ length: totalCells }).map((_, i) => {
            const day = i - firstDay + 1;
            const isValid = day >= 1 && day <= daysInMonth;
            const isToday = isValid && day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
            const isSunday = i % 7 === 0;

            return (
              <div
                key={i}
                className={`p-3 min-h-[60px] border-b border-r border-border ${!isValid ? "bg-muted/20" : ""}`}
              >
                {isValid && (
                  <span className={`text-sm ${isToday ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center" : isSunday ? "text-destructive" : "text-foreground"}`}>
                    {day}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Agendado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">Concluído</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Cancelado</span>
          </div>
        </div>
      </div>
    </div>
  );
}
