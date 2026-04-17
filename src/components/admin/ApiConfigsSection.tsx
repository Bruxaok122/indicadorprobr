import { useState } from "react";
import { useApiConfigs, ApiConfig } from "@/hooks/useApiConfigs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, CheckCircle2, XCircle, RefreshCw, Radio, Zap, Signal, SignalHigh, SignalMedium, SignalLow, Gauge } from "lucide-react";
import { getTierConfig } from "@/lib/tierLimits";

export function ApiConfigsSection() {
  const {
    configs,
    activeConfig,
    isLoading,
    addConfig,
    isAdding,
    setActive,
    isSettingActive,
    deleteConfig,
    isDeleting,
    revalidate,
    isRevalidating,
  } = useApiConfigs();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiConfig | null>(null);
  const [form, setForm] = useState({
    name: "",
    access_token: "",
    waba_id: "",
    phone_number_id: "",
    setActive: true,
  });

  const handleAdd = () => {
    if (!form.name || !form.access_token || !form.waba_id || !form.phone_number_id) return;
    addConfig(form, {
      onSuccess: () => {
        setShowAddDialog(false);
        setForm({ name: "", access_token: "", waba_id: "", phone_number_id: "", setActive: true });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" text="Carregando APIs..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            APIs WhatsApp
          </h3>
          <p className="text-sm text-muted-foreground">
            Gerencie suas APIs da Meta. Apenas uma pode estar ativa por vez.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova API
        </Button>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhuma API cadastrada</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Adicione sua primeira API para começar
            </p>
            <Button onClick={() => setShowAddDialog(true)} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Adicionar API
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {configs.map((config) => (
            <Card
              key={config.id}
              className={`transition-all ${
                config.is_active
                  ? "border-primary/50 bg-primary/5 shadow-md"
                  : "border-border"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {config.name}
                      {config.is_active && (
                        <Badge className="bg-primary text-primary-foreground text-xs">
                          <Radio className="h-3 w-3 mr-1 animate-pulse" /> ATIVA
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs font-mono">
                      WABA: {config.waba_id} | Phone: {config.phone_number_id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => revalidate(config.id)}
                      disabled={isRevalidating}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRevalidating ? "animate-spin" : ""}`} />
                    </Button>
                    {!config.is_active && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActive(config.id)}
                          disabled={isSettingActive}
                          className="text-xs"
                        >
                          Ativar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(config)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      config.is_validated
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1.5"
                        : "bg-destructive/10 text-destructive border-destructive/30 gap-1.5"
                    }
                  >
                    {config.is_validated ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {config.is_validated ? "Conectada" : "Bloqueada / Offline"}
                  </Badge>
                  {/* Real Meta Quality Rating */}
                  {config.status_message && (() => {
                    const qMatch = config.status_message.match(/Qualidade:\s*(GREEN|YELLOW|RED|LOW|MEDIUM|HIGH|N\/A)/i);
                    const quality = qMatch?.[1]?.toUpperCase();
                    if (!quality || quality === "N/A") return null;
                    const qConfig = quality === "GREEN" || quality === "HIGH"
                      ? { label: "Quality: Alta", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", icon: SignalHigh }
                      : quality === "YELLOW" || quality === "MEDIUM"
                        ? { label: "Quality: Média", className: "bg-amber-500/10 text-amber-500 border-amber-500/30", icon: SignalMedium }
                        : { label: "Quality: Baixa", className: "bg-destructive/10 text-destructive border-destructive/30", icon: SignalLow };
                    const QIcon = qConfig.icon;
                    return (
                      <Badge variant="outline" className={`${qConfig.className} gap-1`}>
                        <QIcon className="h-3.5 w-3.5" />
                        {qConfig.label}
                      </Badge>
                    );
                  })()}
                </div>
                {config.status_message && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {config.status_message}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  Atualizado: {new Date(config.updated_at).toLocaleString("pt-BR")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Nova API</DialogTitle>
            <DialogDescription>
              Insira os dados da sua API WhatsApp Business (Meta)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da API</Label>
              <Input
                placeholder="Ex: API Principal, API Backup..."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input
                type="password"
                placeholder="Token de acesso da Meta"
                value={form.access_token}
                onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>WABA ID</Label>
              <Input
                placeholder="ID da conta WhatsApp Business"
                value={form.waba_id}
                onChange={(e) => setForm((f) => ({ ...f, waba_id: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input
                placeholder="ID do número de telefone"
                value={form.phone_number_id}
                onChange={(e) => setForm((f) => ({ ...f, phone_number_id: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="set-active"
                checked={form.setActive}
                onChange={(e) => setForm((f) => ({ ...f, setActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="set-active" className="text-sm cursor-pointer">
                Definir como API ativa
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isAdding || !form.name || !form.access_token || !form.waba_id || !form.phone_number_id}
            >
              {isAdding ? <LoadingSpinner size="sm" /> : "Adicionar e Validar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover API?</AlertDialogTitle>
            <AlertDialogDescription>
              A API <strong>{deleteTarget?.name}</strong> será removida permanentemente.
              Contatos vinculados a esta API não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteConfig(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
