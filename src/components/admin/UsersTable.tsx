 import { Profile } from "@/types/juriszap";
 import { Badge } from "@/components/ui/badge";
 import { Phone, CalendarClock, Smartphone, SmartphoneNfc, Eye } from "lucide-react";
 import { Switch } from "@/components/ui/switch";
 import { Button } from "@/components/ui/button";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from "@/components/ui/table";
 import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
 } from "@/components/ui/tooltip";
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
 import { Lock, Unlock, Trash2, Monitor, Timer } from "lucide-react";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
interface UsersTableProps {
  users: Profile[];
  onToggleBlock: (params: { userId: string; isBlocked: boolean }) => void;
  onToggleApiPermission: (params: { userId: string; canUseSharedApi: boolean }) => void;
  onDelete: (userId: string) => void;
  onClearTempBan: (userId: string) => void;
  onManagePhones: (user: Profile) => void;
  onSetPlan: (params: { userId: string; plan: string | null }) => void;
  onAuthorizeDevice: (userId: string) => void;
  onResetDevice: (userId: string) => void;
  onMonitorChat: (user: Profile) => void;
}
 
 export function UsersTable({ users, onToggleBlock, onToggleApiPermission, onDelete, onClearTempBan, onManagePhones, onSetPlan, onAuthorizeDevice, onResetDevice, onMonitorChat }: UsersTableProps) {
   return (
     <Table>
       <TableHeader>
         <TableRow>
           <TableHead>Usuário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>API Compartilhada</TableHead>
           <TableHead>Dispositivo</TableHead>
           <TableHead>Mensagens</TableHead>
           <TableHead>Último Acesso</TableHead>
           <TableHead className="text-right">Ações</TableHead>
         </TableRow>
       </TableHeader>
       <TableBody>
         {users.map((user) => {
           const isTempBanned = user.temp_banned_until && new Date(user.temp_banned_until) > new Date();
           
           return (
             <TableRow key={user.id}>
               <TableCell>
                 <div>
                   <p className="font-medium">{user.full_name}</p>
                   <p className="text-sm text-muted-foreground">{user.email}</p>
                 </div>
               </TableCell>
               <TableCell>
                 <div className="flex flex-col gap-1">
                   {user.is_blocked ? (
                     <Badge variant="destructive">Bloqueado</Badge>
                   ) : (
                     <Badge variant="default" className="bg-success">Ativo</Badge>
                   )}
                   {isTempBanned && (
                     <Tooltip>
                       <TooltipTrigger>
                         <Badge variant="outline" className="border-warning text-warning">
                           <Timer className="mr-1 h-3 w-3" />
                           Ban Temp
                         </Badge>
                       </TooltipTrigger>
                       <TooltipContent>
                         <div className="text-xs">
                           <p>Até: {format(new Date(user.temp_banned_until!), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                           {user.ban_reason && <p>Motivo: {user.ban_reason}</p>}
                           <Button 
                             size="sm" 
                             variant="outline" 
                             className="mt-2 w-full"
                             onClick={(e) => {
                               e.stopPropagation();
                               onClearTempBan(user.user_id);
                             }}
                           >
                             Remover Ban
                           </Button>
                         </div>
                       </TooltipContent>
                     </Tooltip>
                   )}
                 </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Select
                      value={user.subscription_plan || "none"}
                      onValueChange={(value) =>
                        onSetPlan({
                          userId: user.user_id,
                          plan: value === "none" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
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
                </TableCell>
                <TableCell>
                  <Switch
                    checked={user.can_use_shared_api || false}
                    onCheckedChange={(checked) =>
                      onToggleApiPermission({
                        userId: user.user_id,
                        canUseSharedApi: checked,
                      })
                    }
                  />
                </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1.5">
                {user.authorized_fingerprint ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-sm">
                        <Smartphone className="h-3 w-3 text-success" />
                        <span className="text-success text-xs font-medium">Autorizado</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-success">✓ Dispositivo autorizado</p>
                        <p>
                          {(user.authorized_device_info as any)?.device || "Desktop"} — {(user.authorized_device_info as any)?.browser || "?"} no {(user.authorized_device_info as any)?.os || "?"}
                        </p>
                        <p className="font-mono text-[10px] opacity-60">
                          ID: {user.authorized_fingerprint?.slice(0, 16)}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : user.device_fingerprint ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-sm">
                        <SmartphoneNfc className="h-3 w-3 text-warning" />
                        <span className="text-warning text-xs font-medium">Pendente</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-warning">⏳ Aguardando autorização</p>
                        <p>
                          {(user.last_device_info as any)?.device || "Desktop"} — {(user.last_device_info as any)?.browser || "?"} no {(user.last_device_info as any)?.os || "?"}
                        </p>
                        <p className="font-mono text-[10px] opacity-60">
                          ID: {user.device_fingerprint?.slice(0, 16)}
                        </p>
                        {user.last_login_at && (
                          <p className="opacity-60">
                            Tentou em: {format(new Date(user.last_login_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground text-xs">Nenhum</span>
                )}

                {/* Pending NEW device indicator */}
                {user.authorized_fingerprint && user.device_fingerprint && user.device_fingerprint !== user.authorized_fingerprint && (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-sm">
                        <SmartphoneNfc className="h-3 w-3 text-warning animate-pulse" />
                        <span className="text-warning text-[10px]">Novo pendente</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-warning">🔄 Novo dispositivo tentou acessar</p>
                        <p>
                          {(user.last_device_info as any)?.device || "Desktop"} — {(user.last_device_info as any)?.browser || "?"} no {(user.last_device_info as any)?.os || "?"}
                        </p>
                        <p className="font-mono text-[10px] opacity-60">
                          ID: {user.device_fingerprint?.slice(0, 16)}
                        </p>
                        {user.last_login_at && (
                          <p className="opacity-60">
                            Tentou em: {format(new Date(user.last_login_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Device action buttons */}
                <div className="flex gap-1">
                  {user.device_fingerprint && user.device_fingerprint !== user.authorized_fingerprint && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onAuthorizeDevice(user.user_id)}
                        >
                          <Smartphone className="h-3 w-3 text-success" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {user.authorized_fingerprint ? "Trocar para o novo dispositivo" : "Autorizar dispositivo"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {user.authorized_fingerprint && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => onResetDevice(user.user_id)}
                        >
                          <SmartphoneNfc className="h-3 w-3 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Revogar dispositivo autorizado</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </TableCell>
               <TableCell>
                 <span className="font-mono">{user.messages_sent}</span>
               </TableCell>
               <TableCell>
                 {user.last_login_at ? (
                   <span className="text-sm text-muted-foreground">
                     {format(new Date(user.last_login_at), "dd/MM/yyyy HH:mm", {
                       locale: ptBR,
                     })}
                   </span>
                 ) : (
                   <span className="text-muted-foreground">-</span>
                 )}
               </TableCell>
               <TableCell className="text-right">
                 <div className="flex justify-end gap-1">
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8"
                         onClick={() => onMonitorChat(user)}
                       >
                         <Eye className="h-4 w-4 text-accent" />
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent>Monitorar chat em tempo real</TooltipContent>
                   </Tooltip>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8"
                         onClick={() => onManagePhones(user)}
                       >
                         <Phone className="h-4 w-4 text-primary" />
                       </Button>
                     </TooltipTrigger>
                     <TooltipContent>Gerenciar números de disparo</TooltipContent>
                   </Tooltip>
                   {isTempBanned && (
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 w-8"
                           onClick={() => onClearTempBan(user.user_id)}
                         >
                           <Timer className="h-4 w-4 text-warning" />
                         </Button>
                       </TooltipTrigger>
                       <TooltipContent>Remover bloqueio temporário</TooltipContent>
                     </Tooltip>
                   )}
                   <Tooltip>
                     <TooltipTrigger asChild>
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
                     </TooltipTrigger>
                     <TooltipContent>
                       {user.is_blocked ? "Desbloquear" : "Bloquear"}
                     </TooltipContent>
                   </Tooltip>
 
                   <AlertDialog>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <AlertDialogTrigger asChild>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-8 w-8 text-destructive hover:bg-destructive/10"
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </AlertDialogTrigger>
                       </TooltipTrigger>
                       <TooltipContent>Excluir usuário</TooltipContent>
                     </Tooltip>
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
               </TableCell>
             </TableRow>
           );
         })}
       </TableBody>
     </Table>
   );
 }