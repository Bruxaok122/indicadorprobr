 import { Profile } from "@/types/juriszap";
 import { Badge } from "@/components/ui/badge";
 import { Switch } from "@/components/ui/switch";
 import { Button } from "@/components/ui/button";
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
 }
 
 export function UsersTable({ users, onToggleBlock, onToggleApiPermission, onDelete, onClearTempBan }: UsersTableProps) {
   return (
     <Table>
       <TableHeader>
         <TableRow>
           <TableHead>Usuário</TableHead>
           <TableHead>Status</TableHead>
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
              {(user as any).active_session ? (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-1 text-sm">
                      <Monitor className="h-3 w-3 text-success" />
                      <span className="text-success">Online</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      {(user as any).active_session.device_info && (
                        <>
                          <p>Browser: {(user as any).active_session.device_info.browser}</p>
                          <p>OS: {(user as any).active_session.device_info.os}</p>
                        </>
                      )}
                      <p>Última atividade: {format(new Date((user as any).active_session.last_seen_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : user.last_device_info ? (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Monitor className="h-3 w-3" />
                      Offline
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p>Browser: {(user.last_device_info as any).browser}</p>
                      <p>OS: {(user.last_device_info as any).os}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
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