import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { File, Wand2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  parseUniversalRecords, guessTarget, buildUniversalContacts,
  UNIVERSAL_TARGET_OPTIONS, UniversalTarget, UniversalContact,
} from "@/lib/parseUniversalList";

export interface UniversalImportPanelProps {
  onParsed: (contacts: UniversalContact[], errors: string[]) => void;
}

/** Importação "Chave: Valor" com detecção automática e mapeamento editável. */
export function UniversalImportPanel({ onParsed }: UniversalImportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [mapping, setMapping] = useState<Record<string, UniversalTarget>>({});

  const records = useMemo(() => parseUniversalRecords(raw), [raw]);
  const keys = useMemo(() => {
    const s = new Map<string, string>();
    records.forEach((r) => Object.entries(r).forEach(([k, v]) => { if (!s.has(k) && v) s.set(k, v); }));
    return [...s.entries()];
  }, [records]);

  const targetOf = (k: string): UniversalTarget => mapping[k] ?? guessTarget(k);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(txt|csv)$/i.test(f.name)) { toast.error("Apenas arquivos .txt"); return; }
    setRaw(await f.text());
    setMapping({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleProcess = () => {
    const full: Record<string, UniversalTarget> = {};
    keys.forEach(([k]) => { full[k] = targetOf(k); });
    if (!Object.values(full).includes("name") || !Object.values(full).includes("phone")) {
      toast.error("Defina qual campo é o Nome e qual é o Telefone");
      return;
    }
    const { contacts, errors } = buildUniversalContacts(records, full);
    if (contacts.length === 0) { toast.warning("Nenhum contato válido encontrado"); return; }
    onParsed(contacts, errors);
  };

  return (
    <div className="space-y-3">
      <input type="file" ref={fileRef} onChange={handleFile} accept=".txt,.csv" className="hidden" />
      <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
        <File className="h-4 w-4 mr-1.5" /> Carregar Arquivo .txt
      </Button>
      <Textarea
        placeholder="Nome: FULANO | Email: x@y.com | Celular: 92984165550 | DIA ENCERRAMENTO: 04/11/2026"
        value={raw}
        onChange={(e) => { setRaw(e.target.value); }}
        className="min-h-[120px] font-mono text-xs"
      />

      {keys.length > 0 && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5 text-primary" />
            {records.length} registro(s) · {keys.length} campo(s) detectado(s). Ajuste se necessário:
          </div>
          {keys.map(([k, sample]) => (
            <div key={k} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              <div className="min-w-0">
                <Badge variant="outline" className="text-xs">{k}</Badge>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">ex: {sample}</p>
              </div>
              <Select value={targetOf(k)} onValueChange={(v) => setMapping((p) => ({ ...p, [k]: v as UniversalTarget }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIVERSAL_TARGET_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">
            Somente os campos com variável designada entram na importação. Campos marcados como "Ignorar" são descartados.
          </p>
        </div>
      )}

      <Button className="w-full" onClick={handleProcess} disabled={records.length === 0}>
        <Upload className="h-4 w-4 mr-1.5" /> Processar Lista Universal
      </Button>
    </div>
  );
}
