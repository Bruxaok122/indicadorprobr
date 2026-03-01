import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Wand2, CheckCircle, XCircle, AlertTriangle, Phone } from "lucide-react";

interface StepResult {
  step: string;
  status: "ok" | "error" | "skipped";
  detail: string;
}

const STEP_LABELS: Record<string, string> = {
  config: "Configuração WhatsApp",
  sms24h_saldo: "Saldo SMS24H",
  sms24h_numero: "Obter Número",
  meta_registro: "Registrar na Meta",
  meta_solicitar_codigo: "Solicitar Código SMS",
  sms24h_codigo: "Aguardar Código SMS",
  meta_verificar_codigo: "Verificar Código na Meta",
  meta_registrar_pin: "Registrar PIN",
  sms24h_finalizar: "Finalizar Ativação SMS24H",
  salvar_db: "Salvar no Banco de Dados",
  fatal: "Erro Fatal",
};

const SERVICES = [
  { value: "wa", label: "WhatsApp" },
  { value: "fb", label: "Facebook" },
];

const OPERATORS = [
  { value: "any", label: "Qualquer operadora" },
  { value: "claro", label: "Claro" },
  { value: "vivo", label: "Vivo" },
  { value: "tim", label: "Tim" },
  { value: "oi", label: "Oi" },
];

export function AutoRegisterNumber() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [result, setResult] = useState<{ success?: boolean; phone_number?: string; error?: string } | null>(null);
  const [operator, setOperator] = useState("any");
  const [service, setService] = useState("wa");
  const [pin, setPin] = useState("000000");
  const queryClient = useQueryClient();

  const handleAutoRegister = async () => {
    setIsRunning(true);
    setSteps([]);
    setResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-register-number`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ operator, pin, service }),
        }
      );

      const data = await response.json();

      setSteps(data.steps || []);

      if (!response.ok || data.error) {
        const errorMsg = data.error || `Erro HTTP ${response.status}`;
        toast.error("Falha no registro", { description: errorMsg });
        setResult({ error: errorMsg });
        return;
      }

      if (data.success) {
        setResult({ success: true, phone_number: data.phone_number });
        toast.success(`Número ${data.phone_number} registrado com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
        queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
      } else {
        setResult({ error: data.error || "Falha desconhecida" });
        toast.error("Falha no registro automático", { description: data.error });
      }
    } catch (err: any) {
      toast.error("Erro inesperado", { description: err.message });
      setResult({ error: err.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Registro Automático de Número
            </CardTitle>
            <CardDescription>
              Gera um número via SMS24H, registra na Meta e verifica automaticamente com um clique
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Config */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Serviço</Label>
            <Select value={service} onValueChange={setService} disabled={isRunning}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Operadora</Label>
            <Select value={operator} onValueChange={setOperator} disabled={isRunning}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">PIN (6 dígitos)</Label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="h-9"
              disabled={isRunning}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleAutoRegister}
              disabled={isRunning || pin.length !== 6}
              className="w-full gap-2"
            >
              {isRunning ? (
                <>
                  <LoadingSpinner size="sm" />
                  Processando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Registrar Automático
                </>
              )}
            </Button>
          </div>
        </div>

        {isRunning && steps.length === 0 && (
          <div className="flex items-center justify-center py-6 gap-3">
            <LoadingSpinner size="md" />
            <p className="text-sm text-muted-foreground">
              Iniciando processo... Pode levar até 2 minutos aguardando o SMS.
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              result.success
                ? "bg-green-500/10 border-green-500/30"
                : "bg-destructive/10 border-destructive/30"
            }`}
          >
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-medium ${result.success ? "text-green-400" : "text-destructive"}`}>
                {result.success
                  ? `Número ${result.phone_number} registrado com sucesso!`
                  : `Falha: ${result.error}`}
              </p>
            </div>
          </div>
        )}

        {/* Steps log */}
        {steps.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Log de Execução
            </p>
            <div className="space-y-1">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2 rounded-md text-xs ${
                    s.status === "ok"
                      ? "bg-green-500/10"
                      : s.status === "error"
                      ? "bg-destructive/10"
                      : "bg-muted/50"
                  }`}
                >
                  {s.status === "ok" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : s.status === "error" ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold">{STEP_LABELS[s.step] || s.step}: </span>
                    <span className="text-muted-foreground">{s.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
