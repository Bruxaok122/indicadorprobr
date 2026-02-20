import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Phone, RefreshCw, CheckCircle, XCircle, Pencil, Save, X } from "lucide-react";
import { useWabaPhones, WabaPhoneNumber } from "@/hooks/useWabaPhones";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function PhoneNumbersSection() {
  const { allPhones, isLoading, syncPhones, isSyncing } = useWabaPhones();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Números de Disparo
            </CardTitle>
            <CardDescription>
              Sincronize e gerencie os números disponíveis para envio via WhatsApp
            </CardDescription>
          </div>
          <Button
            onClick={() => syncPhones()}
            disabled={isSyncing}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar da Meta"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" text="Carregando números..." />
          </div>
        ) : allPhones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Phone className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum número sincronizado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Sincronizar da Meta" para buscar os números da sua conta WABA
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allPhones.map((phone) => (
              <PhoneCard key={phone.id} phone={phone} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhoneCard({ phone }: { phone: WabaPhoneNumber & { lawyer_name?: string | null } }) {
  const [editing, setEditing] = useState(false);
  const [lawyerName, setLawyerName] = useState(phone.lawyer_name || "");
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("waba_phone_numbers")
        .update({ lawyer_name: lawyerName.trim() || null } as any)
        .eq("id", phone.id);
      if (error) throw error;
      toast.success("Advogado atualizado!");
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
      setEditing(false);
    } catch (err: any) {
      toast.error("Erro ao salvar", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Phone className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{phone.display_phone_number}</p>
          {phone.verified_name && (
            <p className="text-xs text-muted-foreground truncate">{phone.verified_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {phone.quality_rating && (
            <Badge variant="outline" className="text-xs">
              {phone.quality_rating}
            </Badge>
          )}
          {(phone as any).is_active ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </div>
      </div>

      {/* Lawyer name section */}
      {editing ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Advogado</Label>
          <div className="flex gap-1.5">
            <Input
              value={lawyerName}
              onChange={(e) => setLawyerName(e.target.value)}
              placeholder="Nome do advogado..."
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <LoadingSpinner size="sm" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => { setEditing(false); setLawyerName(phone.lawyer_name || ""); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {(phone as any).lawyer_name ? (
              <span>Advogado: <span className="font-medium text-foreground">{(phone as any).lawyer_name}</span></span>
            ) : (
              <span className="italic">Sem advogado atribuído</span>
            )}
          </p>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
