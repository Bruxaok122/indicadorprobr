 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
 import { LoadingSpinner } from "@/components/ui/loading-spinner";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { UserPlus } from "lucide-react";
 
 interface CreateUserDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onCreate: (params: {
     email: string;
     password: string;
     fullName: string;
     canUseSharedApi: boolean;
   }, options: { onSuccess: () => void }) => void;
   isCreating: boolean;
 }
 
 export function CreateUserDialog({ open, onOpenChange, onCreate, isCreating }: CreateUserDialogProps) {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [name, setName] = useState("");
   const [canUseApi, setCanUseApi] = useState(false);
 
   const handleCreate = () => {
     if (!email || !password || !name) return;
 
     onCreate(
       {
         email,
         password,
         fullName: name,
         canUseSharedApi: canUseApi,
       },
       {
         onSuccess: () => {
           onOpenChange(false);
           setEmail("");
           setPassword("");
           setName("");
           setCanUseApi(false);
         },
       }
     );
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-[95vw] sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Criar Novo Usuário</DialogTitle>
           <DialogDescription>
             Preencha os dados para criar uma nova conta de usuário
           </DialogDescription>
         </DialogHeader>
         <div className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="name">Nome Completo</Label>
             <Input
               id="name"
               placeholder="João Silva"
               value={name}
               onChange={(e) => setName(e.target.value)}
             />
           </div>
           <div className="space-y-2">
             <Label htmlFor="email">Email</Label>
             <Input
               id="email"
               type="email"
               placeholder="joao@email.com"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
             />
           </div>
           <div className="space-y-2">
             <Label htmlFor="password">Senha</Label>
             <Input
               id="password"
               type="password"
               placeholder="••••••••"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
             />
           </div>
           <div className="flex items-center justify-between rounded-lg border p-4">
             <div className="space-y-0.5">
               <Label>Usar API Compartilhada</Label>
               <p className="text-sm text-muted-foreground">
                 Permitir usar a API do administrador
               </p>
             </div>
             <Switch
               checked={canUseApi}
               onCheckedChange={setCanUseApi}
             />
           </div>
         </div>
         <DialogFooter className="flex-col sm:flex-row gap-2">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
             Cancelar
           </Button>
           <Button
             onClick={handleCreate}
             disabled={!email || !password || !name || isCreating}
             className="w-full sm:w-auto"
           >
             {isCreating ? (
               <>
                 <LoadingSpinner size="sm" />
                 Criando...
               </>
             ) : (
               <>
                 <UserPlus className="mr-2 h-4 w-4" />
                 Criar Usuário
               </>
             )}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }