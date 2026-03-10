import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Copy, Check, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface FichaContact {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  lawyer_name: string | null;
  process_number: string | null;
  valor_da_causa: number | null;
  bank_data: any;
  ai_stage: string | null;
  created_at: string;
  updated_at: string;
  dispatched_phone_number_id: string | null;
  advogado_name?: string;
}

function buildFichaText(c: FichaContact): string {
  const bank = c.bank_data || {};
  const valorFormatado = c.valor_da_causa
    ? `R$ ${Number(c.valor_da_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";

  const lines = [
    `ADVOGADO: ${c.advogado_name || "—"}`,
    "",
    `PARTE CONTRÁRIA: ${c.lawyer_name || "—"}`,
    "",
    `PROCESSO: ${c.process_number || "—"}`,
    "",
    `👤 Nome: ${c.name}`,
    "",
    `💳 Doc. CPF: ${c.cpf || "—"}`,
    "",
    `📞 Telefones: ${c.phone}`,
    "",
    `💰 Valor da Causa: ${valorFormatado}`,
    "",
    `DATA AGENDADA: AGORA`,
    "",
    `Dados bancários:`,
    "",
    `CPF: ${c.cpf || "—"}`,
    "",
    bank.banco || "—",
    "",
    `Agência: ${bank.agencia || "—"}`,
    "",
    `Conta: ${bank.conta || "—"}`,
  ];

  return lines.join("\n");
}

const STAGE_LABELS: Record<string, string> = {
  aguardando_confirmacao_doc: "Aguardando Doc",
  aguardando_dados_bancarios: "Aguardando Dados",
  aguardando_confirmacao_chamada: "Aguardando Chamada",
  pronto_para_compliance: "Pronto p/ Compliance",
  compliance_confirmado: "Compliance OK",
};

export function AdminFichasPanel() {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["admin-fichas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone, cpf, lawyer_name, process_number, valor_da_causa, bank_data, ai_stage, created_at, updated_at")
        .eq("ai_enabled", true)
        .in("ai_stage", ["pronto_para_compliance", "compliance_confirmado"])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as FichaContact[];
    },
    refetchInterval: 10000,
  });

  const handleCopy = async (contact: FichaContact) => {
    const text = buildFichaText(contact);
    await navigator.clipboard.writeText(text);
    setCopiedId(contact.id);
    toast.success("Ficha copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = (contacts || []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.cpf || "").includes(q) ||
      (c.lawyer_name || "").toLowerCase().includes(q) ||
      (c.process_number || "").includes(q)
    );
  });

  // Group: compliance_confirmado first, then pronto_para_compliance
  const confirmados = filtered.filter((c) => c.ai_stage === "compliance_confirmado");
  const prontos = filtered.filter((c) => c.ai_stage === "pronto_para_compliance");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Carregando fichas..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="whitespace-nowrap">
          {contacts?.length || 0} fichas
        </Badge>
      </div>

      {confirmados.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-green-500 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Compliance Confirmado ({confirmados.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {confirmados.map((c) => (
              <FichaCard key={c.id} contact={c} onCopy={handleCopy} isCopied={copiedId === c.id} />
            ))}
          </div>
        </div>
      )}

      {prontos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Prontos para Compliance ({prontos.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {prontos.map((c) => (
              <FichaCard key={c.id} contact={c} onCopy={handleCopy} isCopied={copiedId === c.id} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhuma ficha encontrada</p>
          <p className="text-sm">Fichas são geradas quando a IA é ativada em um contato</p>
        </div>
      )}
    </div>
  );
}

function FichaCard({ contact, onCopy, isCopied }: { contact: FichaContact; onCopy: (c: FichaContact) => void; isCopied: boolean }) {
  const bank = contact.bank_data || {};
  const hasBankData = bank.banco || bank.agencia || bank.conta;
  const stageLabel = STAGE_LABELS[contact.ai_stage || ""] || contact.ai_stage || "—";
  const isPronto = contact.ai_stage === "pronto_para_compliance";

  return (
    <Card className={isPronto ? "border-green-500/50 shadow-green-500/10 shadow-md" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{contact.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{contact.phone}</p>
          </div>
          <Badge
            variant={isPronto ? "default" : "secondary"}
            className={isPronto ? "bg-green-500 text-white shrink-0" : "shrink-0"}
          >
            {stageLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <span>Advogado:</span>
          <span className="text-foreground font-medium truncate">{contact.lawyer_name || "—"}</span>
          <span>Processo:</span>
          <span className="text-foreground font-medium truncate">{contact.process_number || "—"}</span>
          <span>CPF:</span>
          <span className="text-foreground font-medium">{contact.cpf || "—"}</span>
          <span>Valor:</span>
          <span className="text-foreground font-medium">
            {contact.valor_da_causa
              ? `R$ ${Number(contact.valor_da_causa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : "—"}
          </span>
        </div>

        {hasBankData && (
          <div className="rounded-lg bg-muted/50 p-2 space-y-0.5 text-xs">
            <p className="font-semibold text-foreground">Dados Bancários:</p>
            <p>Banco: {bank.banco || "—"}</p>
            <p>Agência: {bank.agencia || "—"}</p>
            <p>Conta: {bank.conta || "—"}</p>
            {bank.tipo && <p>Tipo: {bank.tipo}</p>}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onCopy(contact)}
        >
          {isCopied ? (
            <><Check className="mr-2 h-3.5 w-3.5 text-green-500" /> Copiado!</>
          ) : (
            <><Copy className="mr-2 h-3.5 w-3.5" /> Copiar Ficha</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
