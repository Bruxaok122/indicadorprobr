 import { Profile } from "@/types/juriszap";
 import { Card, CardContent } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Switch } from "@/components/ui/switch";
 import { Button } from "@/components/ui/button";
 import { Lock, Unlock, Trash2, Timer, Monitor, Phone, CalendarClock, Smartphone, SmartphoneNfc } from "lucide-react";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from "@/components/ui/alert-dialog";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
interface UserCardProps {
  user: Profile;
  onToggleBlock: (params: { userId: string; isBlocked: boolean }) => void;
  onToggleApiPermission: (params: { userId: string; canUseSharedApi: boolean }) => void;
  onDelete: (userId: string) => void;
  onClearTempBan: (userId: string) => void;
  onManagePhones: (user: Profile) => void;
  onSetPlan: (params: { userId: string; plan: string | null }) => void;
  onAuthorizeDevice: (userId: string) => void;
  onResetDevice: (userId: string) => void;
}

export function UserCard({ user, onToggleBlock, onToggleApiPermission, onDelete, onClearTempBan, onManagePhones, onSetPlan, onAuthorizeDevice, onResetDevice }: UserCardProps) {
   const isTempBanned = user.temp_banned_until && new Date(user.temp_banned_until) > new Date();
 
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
         <div className="space-y-2 border rounded-md p-2">
           <span className="text-sm font-medium">Dispositivo</span>
           {user.authorized_fingerprint ? (
             <div className="flex items-center gap-2">
               <Smartphone className="h-4 w-4 text-success" />
               <div className="flex-1 min-w-0">
                 <p className="text-xs text-success font-medium">Autorizado</p>
                 <p className="text-xs text-muted-foreground truncate">
                   {(user.authorized_device_info as any)?.browser} / {(user.authorized_device_info as any)?.os}
                 </p>
               </div>
               <Button
                 variant="outline"
                 size="sm"
                 className="h-7 text-xs text-destructive"
                 onClick={() => onResetDevice(user.user_id)}
               >
                 Revogar
               </Button>
             </div>
           ) : user.device_fingerprint ? (
             <div className="flex items-center gap-2">
               <SmartphoneNfc className="h-4 w-4 text-warning" />
               <div className="flex-1 min-w-0">
                 <p className="text-xs text-warning font-medium">Pendente</p>
                 <p className="text-xs text-muted-foreground truncate">
                   {(user.last_device_info as any)?.browser} / {(user.last_device_info as any)?.os}
                 </p>
               </div>
               <Button
                 variant="outline"
                 size="sm"
                 className="h-7 text-xs text-success"
                 onClick={() => onAuthorizeDevice(user.user_id)}
               >
                 Autorizar
               </Button>
             </div>
           ) : (
             <p className="text-xs text-muted-foreground">Nenhum login registrado</p>
           )}
           {/* Show pending device if authorized but a different one is pending */}
           {user.authorized_fingerprint && user.device_fingerprint && user.device_fingerprint !== user.authorized_fingerprint && (
             <div className="flex items-center gap-2 border-t pt-2">
               <SmartphoneNfc className="h-4 w-4 text-warning" />
               <div className="flex-1 min-w-0">
                 <p className="text-xs text-warning font-medium">Novo dispositivo pendente</p>
                 <p className="text-xs text-muted-foreground truncate">
                   {(user.last_device_info as any)?.browser} / {(user.last_device_info as any)?.os}
                 </p>
               </div>
               <Button
                 variant="outline"
                 size="sm"
                 className="h-7 text-xs text-success"
                 onClick={() => onAuthorizeDevice(user.user_id)}
               >
                 Autorizar
               </Button>
             </div>
           )}
         </div>

          {/* Plan selector */}
          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Plano</span>
            <Select
              value={user.subscription_plan || "none"}
              onValueChange={(value) =>
                onSetPlan({
                  userId: user.user_id,
                  plan: value === "none" ? null : value,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
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

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
           <div className="flex items-center gap-2">
             <span className="text-sm text-muted-foreground">API</span>
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
           <div className="flex gap-1">
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
 
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-8 w-8 text-destructive hover:bg-destructive/10"
                 >
                   <Trash2 className="h-4 w-4" />
                 </Button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                 <AlertDialogHeader>
                   <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                   <AlertDialogDescription>
                     Esta ação não pode ser desfeita. O usuário{" "}
                     <strong>{user.full_name}</strong> e todos os seus dados serão
                     removidos permanentemente.
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                   <AlertDialogCancel>Cancelar</AlertDialogCancel>
                   <AlertDialogAction
                     onClick={() => onDelete(user.user_id)}
                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                   >
                     Excluir
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
             </AlertDialog>
           </div>
         </div>
       </CardContent>
     </Card>
   );
 }