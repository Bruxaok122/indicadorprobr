 import { Profile } from "@/types/juriszap";
 import { Card, CardContent } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Switch } from "@/components/ui/switch";
 import { Button } from "@/components/ui/button";
 import { Lock, Unlock, Trash2, Timer, Monitor } from "lucide-react";
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
 }
 
 export function UserCard({ user, onToggleBlock, onToggleApiPermission, onDelete, onClearTempBan }: UserCardProps) {
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
          {(user as any).active_session ? (
            <div className="col-span-2 flex items-center gap-1">
              <Monitor className="h-3 w-3 text-success" />
              <span className="text-xs text-success">
                Online - {format(new Date((user as any).active_session.last_seen_at), "HH:mm", { locale: ptBR })}
              </span>
            </div>
          ) : user.last_device_info ? (
            <div className="col-span-2 flex items-center gap-1">
              <Monitor className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">
                Offline - {(user.last_device_info as any).browser} / {(user.last_device_info as any).os}
              </span>
            </div>
          ) : null}
          {user.last_login_at && (
            <div className="col-span-2 text-xs text-muted-foreground">
              Último acesso: {format(new Date(user.last_login_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
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