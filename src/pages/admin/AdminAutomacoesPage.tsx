import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Save, Zap, GripVertical, ArrowLeftRight, Users, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CamposConfig {
  id: string;
  categoria: string;
  subcategoria: string;
  campos: string[];
}

const CATEGORIAS = [
  {
    key: "transfer",
    label: "Transfer Executivo",
    icon: ArrowLeftRight,
    subcategorias: [
      { key: "somente_ida", label: "Somente Ida" },
      { key: "ida_volta", label: "Ida e Volta" },
      { key: "por_hora", label: "Por Hora" },
    ],
  },
  {
    key: "grupo",
    label: "Solicitação de Grupo",
    icon: Users,
    subcategorias: [{ key: "default", label: "Campos" }],
  },
  {
    key: "motorista",
    label: "Solicitação Motorista",
    icon: UserCheck,
    subcategorias: [{ key: "default", label: "Campos" }],
  },
];

export default function AdminAutomacoesPage() {
  const [configs, setConfigs] = useState<CamposConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategoria, setActiveCategoria] = useState("transfer");

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from("automacoes_campos_config" as any)
      .select("*")
      .order("categoria") as any;
    if (error) toast.error("Erro ao carregar configurações");
    else setConfigs((data || []).map((r: any) => ({
      ...r,
      campos: Array.isArray(r.campos) ? r.campos : [],
    })));
    setLoading(false);
  };

  useEffect(() => { fetchConfigs(); }, []);

  const getConfig = (categoria: string, subcategoria: string): CamposConfig | undefined =>
    configs.find((c) => c.categoria === categoria && c.subcategoria === subcategoria);

  const updateCampos = (categoria: string, subcategoria: string, campos: string[]) => {
    setConfigs((prev) => {
      const exists = prev.find((c) => c.categoria === categoria && c.subcategoria === subcategoria);
      if (exists) {
        return prev.map((c) =>
          c.categoria === categoria && c.subcategoria === subcategoria
            ? { ...c, campos }
            : c
        );
      }
      return [...prev, { id: "", categoria, subcategoria, campos }];
    });
  };

  const addField = (categoria: string, subcategoria: string) => {
    const config = getConfig(categoria, subcategoria);
    const campos = config ? [...config.campos, ""] : [""];
    updateCampos(categoria, subcategoria, campos);
  };

  const removeField = (categoria: string, subcategoria: string, index: number) => {
    const config = getConfig(categoria, subcategoria);
    if (!config) return;
    const campos = config.campos.filter((_, i) => i !== index);
    updateCampos(categoria, subcategoria, campos);
  };

  const updateField = (categoria: string, subcategoria: string, index: number, value: string) => {
    const config = getConfig(categoria, subcategoria);
    if (!config) return;
    const campos = config.campos.map((c, i) => (i === index ? value : c));
    updateCampos(categoria, subcategoria, campos);
  };

  const handleSave = async (categoria: string, subcategoria: string) => {
    const config = getConfig(categoria, subcategoria);
    if (!config) return;

    const cleanCampos = config.campos.filter((c) => c.trim() !== "");
    setSaving(true);

    if (config.id) {
      const { error } = await (supabase.from("automacoes_campos_config" as any).update({
        campos: cleanCampos,
        updated_at: new Date().toISOString(),
      } as any).eq("id", config.id) as any);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    } else {
      const { error } = await (supabase.from("automacoes_campos_config" as any).insert({
        categoria,
        subcategoria,
        campos: cleanCampos,
      } as any) as any);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    }

    toast.success("Campos salvos com sucesso!");
    setSaving(false);
    fetchConfigs();
  };

  const renderFieldEditor = (categoria: string, subcategoria: string) => {
    const config = getConfig(categoria, subcategoria);
    const campos = config?.campos || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {campos.length} campo(s) configurado(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addField(categoria, subcategoria)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Campo
            </Button>
            <Button size="sm" onClick={() => handleSave(categoria, subcategoria)} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar
            </Button>
          </div>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {campos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhum campo configurado.</p>
              <p className="text-xs mt-1">Clique em "Adicionar Campo" para começar.</p>
            </div>
          ) : (
            campos.map((campo, index) => (
              <div key={index} className="flex items-center gap-2 group">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <Badge variant="outline" className="shrink-0 text-xs w-8 justify-center">
                  {index + 1}
                </Badge>
                <Input
                  value={campo}
                  onChange={(e) => updateField(categoria, subcategoria, index, e.target.value)}
                  placeholder="Nome do campo..."
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeField(categoria, subcategoria, index)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const activeCat = CATEGORIAS.find((c) => c.key === activeCategoria)!;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" /> Automações — Configuração de Campos
        </h1>
        <p className="text-muted-foreground">
          Defina os campos de formulário que aparecerão para os motoristas em cada categoria de automação.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeCategoria} onValueChange={setActiveCategoria}>
          <TabsList className="w-full grid grid-cols-3 mb-6">
            {CATEGORIAS.map((cat) => (
              <TabsTrigger key={cat.key} value={cat.key} className="flex items-center gap-2">
                <cat.icon className="h-4 w-4" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIAS.map((cat) => (
            <TabsContent key={cat.key} value={cat.key}>
              {cat.subcategorias.length === 1 ? (
                <Card className="p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <cat.icon className="h-4 w-4 text-primary" />
                    {cat.label}
                  </h3>
                  {renderFieldEditor(cat.key, cat.subcategorias[0].key)}
                </Card>
              ) : (
                <Tabs defaultValue={cat.subcategorias[0].key}>
                  <TabsList className="w-full grid mb-4" style={{ gridTemplateColumns: `repeat(${cat.subcategorias.length}, 1fr)` }}>
                    {cat.subcategorias.map((sub) => (
                      <TabsTrigger key={sub.key} value={sub.key}>{sub.label}</TabsTrigger>
                    ))}
                  </TabsList>
                  {cat.subcategorias.map((sub) => (
                    <TabsContent key={sub.key} value={sub.key}>
                      <Card className="p-6">
                        <h3 className="font-semibold text-foreground mb-4">
                          {cat.label} — {sub.label}
                        </h3>
                        {renderFieldEditor(cat.key, sub.key)}
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
