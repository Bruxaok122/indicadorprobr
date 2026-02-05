 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { LoadingSpinner } from "@/components/ui/loading-spinner";
 import { Users, Activity, Lock, MessageSquare, Phone } from "lucide-react";
 
 interface AdminStats {
   totalUsers: number;
   activeUsers: number;
   blockedUsers: number;
   totalMessages: number;
   totalContacts: number;
 }
 
 interface StatsCardsProps {
   stats: AdminStats | undefined;
   isLoading: boolean;
 }
 
 export function StatsCards({ stats, isLoading }: StatsCardsProps) {
   const items = [
     { title: "Total Usuários", value: stats?.totalUsers, icon: Users, color: "" },
     { title: "Ativos", value: stats?.activeUsers, icon: Activity, color: "text-success" },
     { title: "Bloqueados", value: stats?.blockedUsers, icon: Lock, color: "text-destructive" },
     { title: "Mensagens", value: stats?.totalMessages, icon: MessageSquare, color: "" },
     { title: "Contatos", value: stats?.totalContacts, icon: Phone, color: "" },
   ];
 
   return (
     <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
       {items.map((item) => {
         const Icon = item.icon;
         return (
           <Card key={item.title} className="min-w-0">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3 md:px-6 md:pt-6">
               <CardTitle className="text-xs md:text-sm font-medium truncate">{item.title}</CardTitle>
               <Icon className={`h-4 w-4 flex-shrink-0 ${item.color || "text-muted-foreground"}`} />
             </CardHeader>
             <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
               <div className={`text-xl md:text-2xl font-bold ${item.color}`}>
                 {isLoading ? <LoadingSpinner size="sm" /> : item.value || 0}
               </div>
             </CardContent>
           </Card>
         );
       })}
     </div>
   );
 }