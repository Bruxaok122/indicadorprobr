import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, AlertTriangle, Phone, Upload, Trash2, Search, FileSpreadsheet } from "lucide-react";
import { extractDDD, getStateFromDDD } from "@/lib/dddToState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ValidatedNumber {
  original: string;
  normalized: string;
  status: "valid" | "invalid_format" | "landline" | "invalid_ddd" | "no_whatsapp" | "has_whatsapp" | "unknown";
  reason: string;
  state?: string;
}

// DDDs known to exist
const VALID_DDDS = new Set([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46",
  "47","48","49",
  "51","52","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function validateNumber(raw: string): ValidatedNumber {
  const original = raw.trim();
  let digits = normalizePhone(original);

  // Add country code if missing
  if (!digits.startsWith("55") && digits.length <= 11) {
    digits = "55" + digits;
  }

  // Basic length check: 55 + DDD(2) + number(8-9) = 12-13
  if (digits.length < 12 || digits.length > 13) {
    return { original, normalized: digits, status: "invalid_format", reason: "Formato inválido (tamanho incorreto)" };
  }

  const ddd = digits.substring(2, 4);

  // Check valid DDD
  if (!VALID_DDDS.has(ddd)) {
    return { original, normalized: digits, status: "invalid_ddd", reason: `DDD ${ddd} não existe`, state: "Inválido" };
  }

  const numberPart = digits.substring(4);
  const state = getStateFromDDD(ddd);

  // Landline detection: mobile numbers in Brazil start with 9 and have 9 digits
  if (numberPart.length === 8) {
    // 8-digit numbers are landlines
    return { original, normalized: digits, status: "landline", reason: "Número fixo (8 dígitos)", state };
  }

  if (numberPart.length === 9 && !numberPart.startsWith("9")) {
    // 9-digit but doesn't start with 9
    return { original, normalized: digits, status: "landline", reason: "Número fixo (não inicia com 9)", state };
  }

  if (numberPart.length !== 9) {
    return { original, normalized: digits, status: "invalid_format", reason: "Tamanho do número inválido", state };
  }

  return { original, normalized: digits, status: "valid", reason: "Formato válido - celular", state };
}

export function WhatsAppNumberValidator() {
  const [inputText, setInputText] = useState("");
  const [results, setResults] = useState<ValidatedNumber[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const handleValidate = async () => {
    const lines = inputText
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      toast.error("Insira ao menos um número");
      return;
    }

    // Step 1: Local format validation
    const validated = lines.map(validateNumber);

    // Step 2: Check database for known has_whatsapp status
    setIsChecking(true);
    try {
      const validNumbers = validated.filter((v) => v.status === "valid").map((v) => v.normalized);

      if (validNumbers.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("phone, has_whatsapp")
          .in("phone", validNumbers);

        if (contacts) {
          const phoneMap = new Map(contacts.map((c) => [c.phone, c.has_whatsapp]));

          for (const v of validated) {
            if (v.status === "valid") {
              const dbStatus = phoneMap.get(v.normalized);
              if (dbStatus === true) {
                v.status = "has_whatsapp";
                v.reason = "✅ WhatsApp confirmado (histórico)";
              } else if (dbStatus === false) {
                v.status = "no_whatsapp";
                v.reason = "❌ Sem WhatsApp (erro 131026)";
              } else {
                v.status = "unknown";
                v.reason = "⏳ Formato OK — status desconhecido";
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error checking DB:", err);
    } finally {
      setIsChecking(false);
    }

    setResults(validated);
    toast.success(`${validated.length} número(s) analisado(s)`);
  };

  const handleClear = () => {
    setInputText("");
    setResults([]);
  };

  const handleLoadContacts = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("phone")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;

      const phones = (data || []).map((c) => c.phone).filter(Boolean);
      setInputText(phones.join("\n"));
      toast.success(`${phones.length} números carregados dos contatos`);
    } catch (err: any) {
      toast.error("Erro ao carregar contatos", { description: err.message });
    } finally {
      setIsChecking(false);
    }
  };

  const stats = useMemo(() => {
    const total = results.length;
    const valid = results.filter((r) => ["valid", "has_whatsapp", "unknown"].includes(r.status)).length;
    const noWhatsapp = results.filter((r) => r.status === "no_whatsapp").length;
    const hasWhatsapp = results.filter((r) => r.status === "has_whatsapp").length;
    const invalid = results.filter((r) => ["invalid_format", "landline", "invalid_ddd"].includes(r.status)).length;
    const unknown = results.filter((r) => r.status === "unknown").length;
    return { total, valid, noWhatsapp, hasWhatsapp, invalid, unknown };
  }, [results]);

  const getStatusIcon = (status: ValidatedNumber["status"]) => {
    switch (status) {
      case "has_whatsapp":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "no_whatsapp":
        return <span className="text-[10px] font-bold text-destructive leading-none">s/w</span>;
      case "invalid_format":
      case "landline":
      case "invalid_ddd":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "unknown":
      case "valid":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: ValidatedNumber["status"]) => {
    switch (status) {
      case "has_whatsapp":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">WhatsApp ✓</Badge>;
      case "no_whatsapp":
        return <Badge variant="destructive">Sem WhatsApp</Badge>;
      case "invalid_format":
        return <Badge variant="destructive">Formato inválido</Badge>;
      case "landline":
        return <Badge variant="destructive">Fixo</Badge>;
      case "invalid_ddd":
        return <Badge variant="destructive">DDD inválido</Badge>;
      case "unknown":
      case "valid":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Desconhecido</Badge>;
    }
  };

  const handleExportValid = () => {
    const validNumbers = results
      .filter((r) => ["has_whatsapp", "unknown", "valid"].includes(r.status))
      .map((r) => r.normalized);
    if (validNumbers.length === 0) {
      toast.error("Nenhum número válido para exportar");
      return;
    }
    navigator.clipboard.writeText(validNumbers.join("\n"));
    toast.success(`${validNumbers.length} números válidos copiados!`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Validador de Números WhatsApp
          </CardTitle>
          <CardDescription>
            Insira números para validação de formato + verificação de histórico. Números com erro 131026 prévio são marcados como "Sem WhatsApp".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={"Cole números aqui (um por linha, separados por vírgula ou ponto-e-vírgula)\n\nEx:\n5511999998888\n(47) 99999-8888\n11999887766"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-[160px] font-mono text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleValidate} disabled={isChecking || !inputText.trim()}>
              <Search className="mr-2 h-4 w-4" />
              Validar Números
            </Button>
            <Button variant="outline" onClick={handleLoadContacts} disabled={isChecking}>
              <Upload className="mr-2 h-4 w-4" />
              Carregar dos Contatos
            </Button>
            <Button variant="ghost" onClick={handleClear} disabled={results.length === 0 && !inputText}>
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            {results.length > 0 && (
              <Button variant="secondary" onClick={handleExportValid}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Copiar Válidos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </Card>
            <Card className="p-3 text-center border-green-500/30">
              <p className="text-2xl font-bold text-green-500">{stats.hasWhatsapp}</p>
              <p className="text-xs text-muted-foreground">Com WhatsApp</p>
            </Card>
            <Card className="p-3 text-center border-yellow-500/30">
              <p className="text-2xl font-bold text-yellow-500">{stats.unknown}</p>
              <p className="text-xs text-muted-foreground">Desconhecido</p>
            </Card>
            <Card className="p-3 text-center border-destructive/30">
              <p className="text-2xl font-bold text-destructive">{stats.noWhatsapp}</p>
              <p className="text-xs text-muted-foreground">Sem WhatsApp</p>
            </Card>
            <Card className="p-3 text-center border-destructive/30">
              <p className="text-2xl font-bold text-destructive">{stats.invalid}</p>
              <p className="text-xs text-muted-foreground">Inválidos/Fixos</p>
            </Card>
          </div>

          {/* Results list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultados</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-1">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 py-2 px-3 rounded-md hover:bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getStatusIcon(r.status)}
                        <span className="font-mono truncate">{r.normalized}</span>
                        {r.state && (
                          <span className="text-xs text-muted-foreground shrink-0">({r.state})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getStatusBadge(r.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
