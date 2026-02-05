 import { Shield, LogOut, Menu } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { ThemeToggle } from "@/components/ThemeToggle";
 import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
 import { useState } from "react";
 
 interface AdminHeaderProps {
   onLogout: () => void;
   mobileMenu?: React.ReactNode;
 }
 
 export function AdminHeader({ onLogout, mobileMenu }: AdminHeaderProps) {
   const [mobileOpen, setMobileOpen] = useState(false);
 
   return (
     <header className="border-b bg-primary text-primary-foreground">
       <div className="container mx-auto flex h-14 md:h-16 items-center justify-between px-4">
         <div className="flex items-center gap-3">
           <Shield className="h-6 w-6 md:h-8 md:w-8 text-accent" />
           <div>
             <h1 className="text-lg md:text-xl font-bold">JurisZap Admin</h1>
             <p className="text-xs text-primary-foreground/70 hidden sm:block">Painel de Administração</p>
           </div>
         </div>
         <div className="flex items-center gap-2">
           <ThemeToggle />
           <Button
             variant="ghost"
             size="sm"
             onClick={onLogout}
             className="text-primary-foreground hover:bg-primary-foreground/10 hidden sm:flex"
           >
             <LogOut className="mr-2 h-4 w-4" />
             Sair
           </Button>
           {mobileMenu && (
             <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
               <SheetTrigger asChild className="sm:hidden">
                 <Button variant="ghost" size="icon" className="text-primary-foreground">
                   <Menu className="h-5 w-5" />
                 </Button>
               </SheetTrigger>
               <SheetContent side="right" className="w-64 p-0">
                 {mobileMenu}
               </SheetContent>
             </Sheet>
           )}
           <Button
             variant="ghost"
             size="icon"
             onClick={onLogout}
             className="text-primary-foreground hover:bg-primary-foreground/10 sm:hidden"
           >
             <LogOut className="h-5 w-5" />
           </Button>
         </div>
       </div>
     </header>
   );
 }