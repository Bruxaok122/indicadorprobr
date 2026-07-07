import { useState, useEffect } from "react";
import { Profile } from "@/types/juriszap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Unlock, Trash2, Timer, Monitor, Phone, CalendarClock, Smartphone, SmartphoneNfc, Eye, ShieldCheck, Layers } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserCardProps {
  user: Profile;
  onToggleBlock: (params: { userId: string; isBlocked: boolean }) => void;
  onToggleApiPermission: (params: { userId: string; canUseSharedApi: boolean }) => void;
  onToggleManageNumbers: (params: { userId: string; canManageNumbers: boolean }) => void;
  onToggleDispatch: (params: { userId: string; canDispatch: boolean }) => void;
  onToggleBypassCooldown: (params: { userId: string; bypass: boolean }) => void;
  onDelete: (user: Profile) => void;
  onClearTempBan: (userId: string) => void;
  onManagePhones: (user: Profile) => void;
  onSetPlan: (params: { userId: string; plan: string | null }) => void;
  onAuthorizeDevice: (userId: string) => void;
  onResetDevice: (userId: string) => void;
  onMonitorChat: (user: Profile) => void;
  onSetMaxBatchSize?: (params: { userId: string; maxBatchSize: number | null }) => void;
}

export function UserCard({ user, onToggleBlock, onToggleApiPermission, onToggleManageNumbers, onToggleDispatch, onToggleBypassCooldown, onDelete, onClearTempBan, onManagePhones, onSetPlan, onAuthorizeDevice, onResetDevice, onMonitorChat, onSetMaxBatchSize }: UserCardProps) {
   const isTempBanned = user.temp_banned_until && new Date(user.temp_banned_until) > new Date();
   const [batchLimitDraft, setBatchLimitDraft] = useState<string>(
     user.max_batch_size != null ? String(user.max_batch_size) : ""
   );
   useEffect(() => {
     setBatchLimitDraft(user.max_batch_size != null ? String(user.max_batch_size) : "");
   }, [user.max_batch_size]);

   return (
     <Card className="w-full">
       <CardContent className="p-4 space-y-3">
        {/* Header with name and status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{user.full_name}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {user.is_blocked ? (
              <Badge variant="destructive">Bloqueado</Badge>
            ) : isTempBanned ? (
              <Badge variant="outline" className="border-warning text-warning">
                <Timer className="mr-1 h-3 w-3" />
                Ban Temp
              </Badge>
            ) : (
              <Badge variant="default" className="bg-success">Ativo</Badge>
            )}
          </div>
        </div>

        {/* Temp ban info */}
        {isTempBanned && (
          <div className="bg-warning/10 border border-warning/20 rounded-md p-2 text-sm">
            <p className="text-warning font-medium">Bloqueio temporário ativo</p>
            <p className="text-muted-foreground text-xs">
              Até: {format(new Date(user.temp_banned_until!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
            {user.ban_reason && (
              <p className="text-muted-foreground text-xs mt-1">{user.ban_reason}</p>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-2 w-full"
              onClick={() => onClearTempBan(user.user_id)}
            >
              <Unlock className="mr-2 h-3 w-3" />
              Remover Bloqueio Temporário
            </Button>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Mensagens:</span>
            <span className="ml-1 font-mono">{user.messages_sent}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tentativas:</span>
            <span className="ml-1 font-mono">{user.failed_device_attempts || 0}</span>
          </div>
          {user.last_login_at && (
            <div className="col-span-2 text-xs text-muted-foreground">
              Último acesso: {format(new Date(user.last_login_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          )}
        </div>

        {/* Device authorization */}
        <div className="space-y-2 border rounded-md p-3">
          <span className="text-sm font-medium">Dispositivo Autorizado</span>
          {user.authorized_fingerprint ? (
            <div className="space-y-1">
              <div className="flex items-start gap-2">
                <Smartphone className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs text-success font-semibold">✓ Autorizado</p>
                  <p className="text-xs text-foreground">
                    {(user.authorized_device_info as any)?.device || "Desktop"} — {(user.authorized_device_info as any)?.browser || "?"} no {(user.authorized_device_info as any)?.os || "?"}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    ID: {user.authorized_fingerprint?.slice(0, 16)}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => onResetDevice(user.user_id)}
              >
                <SmartphoneNfc className="mr-1 h-3 w-3" />
                Revogar Autorização
              </Button>
            </div>
          ) : user.device_fingerprint ? (
            <div className="space-y-1">
              <div className="flex items-start gap-2">
                <SmartphoneNfc className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs text-warning font-semibold">⏳ Aguardando autorização</p>
                  <p className="text-xs text-foreground">
                    {(user.last_device_info as any)?.device || "Desktop"} — {(user.last_device_info as any)?.browser || "?"} no {(user.last_device_info as any)?.os || "?"}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    ID: {user.device_fingerprint?.slice(0, 16)}
                  </p>
                  {user.last_login_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Tentou em: {format(new Date(user.last_login_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs text-success border-success/30 hover:bg-success/10"
                onClick={() => onAuthorizeDevice(user.user_id)}
              >
                <Smartphone className="mr-1 h-3 w-3" />
                Autorizar Este Dispositivo
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Nenhum login registrado ainda</p>
          )}

          {/* Show pending NEW device if authorized but a different one tried */}
          {user.authorized_fingerprint && user.device_fingerprint && user.device_fingerprint !== user.authorized_fingerprint && (
            <div className="border-t pt-2 space-y-1">
              <div className="flex items-start gap-2">
                <SmartphoneNfc className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-xs text-warning font-semibold">🔄 Novo dispositivo tentou acessar</p>
                  <p className="text-xs text-foreground">
                    {(user.last_device_info as any)?.device || "Desktop"} — {(user.last_device_info as any)?.browser || "?"} no {(user.last_device_info as any)?.os || "?"}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    ID: {user.device_fingerprint?.slice(0, 16)}
                  </p>
                  {user.last_login_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Tentou em: {format(new Date(user.last_login_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs text-success border-success/30 hover:bg-success/10"
                onClick={() => onAuthorizeDevice(user.user_id)}
              >
                <Smartphone className="mr-1 h-3 w-3" />
                Trocar para Este Dispositivo
              </Button>
            </div>
          )}
        </div>

        {/* Plan selector */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm">
            <CalendarClock className="h-4 w-4" />
            <span>Plano</span>
          </div>
          <div className="pl-5">
            <Select
              value={user.subscription_plan || "none"}
              onValueChange={(value) =>
                onSetPlan({
                  userId: user.user_id,
                  plan: value === "none" ? null : value,
                })
              }
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Selecionar plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem plano</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
            {user.subscription_expires_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {new Date(user.subscription_expires_at) > new Date()
                  ? `Até ${format(new Date(user.subscription_expires_at), "dd/MM/yyyy", { locale: ptBR })}`
                  : "Expirado"
                }
              </span>
            )}
          </div>
        </div>

        {/* Batch dispatch limit */}
        {onSetMaxBatchSize && (
          <div className="space-y-1.5 rounded-md border p-3">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Limite de Disparo (Lote)</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Máximo por disparo. Deixe vazio para ilimitado.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Ilimitado"
                value={batchLimitDraft}
                onChange={(e) => setBatchLimitDraft(e.target.value)}
                className="h-8 w-28 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  const trimmed = batchLimitDraft.trim();
                  if (trimmed === "") {
                    onSetMaxBatchSize({ userId: user.user_id, maxBatchSize: null });
                  } else {
                    const n = parseInt(trimmed, 10);
                    if (!isFinite(n) || n < 1) return;
                    onSetMaxBatchSize({ userId: user.user_id, maxBatchSize: n });
                  }
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}

         {/* Actions */}
         <div className="space-y-2 pt-2 border-t">
          {/* All permissions toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Todas as Permissões</span>
            </div>
            <Switch
              checked={
                (user.can_use_shared_api || false) &&
                ((user as any).can_manage_numbers || false) &&
                ((user as any).can_dispatch || false)
              }
              onCheckedChange={(checked) => {
                onToggleApiPermission({ userId: user.user_id, canUseSharedApi: checked });
                onToggleManageNumbers({ userId: user.user_id, canManageNumbers: checked });
                onToggleDispatch({ userId: user.user_id, canDispatch: checked });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="flex items-center gap-1">
               <span className="text-xs text-muted-foreground">API</span>
               <Switch
                 checked={user.can_use_shared_api || false}
                 onCheckedChange={(checked) =>
                   onToggleApiPermission({
                     userId: user.user_id,
                     canUseSharedApi: checked,
                   })
                 }
               />
             </div>
             <div className="flex items-center gap-1">
               <span className="text-xs text-muted-foreground">Números</span>
               <Switch
                 checked={(user as any).can_manage_numbers || false}
                 onCheckedChange={(checked) =>
                   onToggleManageNumbers({
                     userId: user.user_id,
                     canManageNumbers: checked,
                   })
                 }
               />
             </div>
             <div className="flex items-center gap-1">
               <span className="text-xs text-muted-foreground">Disparos</span>
               <Switch
                 checked={(user as any).can_dispatch || false}
                 onCheckedChange={(checked) =>
                   onToggleDispatch({
                     userId: user.user_id,
                     canDispatch: checked,
                   })
                 }
               />
             </div>
             <div className="flex items-center gap-1">
               <span className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" />Sem Timer</span>
               <Switch
                 checked={(user as any).bypass_dispatch_cooldown || false}
                 onCheckedChange={(checked) =>
                   onToggleBypassCooldown({
                     userId: user.user_id,
                     bypass: checked,
                   })
                 }
               />
             </div>
           </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMonitorChat(user)}
              title="Monitorar chat"
            >
              <Eye className="h-4 w-4 text-accent" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onManagePhones(user)}
            >
              <Phone className="h-4 w-4 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                onToggleBlock({
                  userId: user.user_id,
                  isBlocked: !user.is_blocked,
                })
              }
            >
              {user.is_blocked ? (
                <Unlock className="h-4 w-4 text-success" />
              ) : (
                <Lock className="h-4 w-4 text-warning" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(user)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
         </div>
        </div>
      </CardContent>
    </Card>
  );
}
