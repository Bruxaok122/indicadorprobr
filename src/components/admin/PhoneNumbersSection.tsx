import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Phone, RefreshCw, CheckCircle, XCircle, Pencil, Save, X, Trash2 } from "lucide-react";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingName, setIsRefreshingName] = useState(false);
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

  /**
   * Força a Cloud API a baixar o certificado novo (nome de exibição aprovado
   * na Meta que não refletiu em produção). `force` faz o ciclo completo
   * deregister + register, usado apenas quando o re-registro simples falha.
   */
  const handleRefreshName = async (force: boolean) => {
    setIsRefreshingName(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: {
          action: "refresh_display_name",
          phone_number_id: phone.phone_number_id,
          pin: "123456",
          force,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.changed) {
        toast.success(`Nome atualizado para "${data.after?.verified_name}"`);
      } else {
        toast.warning("Certificado re-sincronizado, mas o nome não mudou", {
          description: `Meta reporta: ${data?.after?.verified_name ?? "—"} (name_status: ${data?.after?.name_status ?? "—"})${force ? "" : ". Use 'Forçar' para o ciclo completo."}`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
    } catch (err: any) {
      toast.error("Erro ao atualizar nome", { description: err.message });
    } finally {
      setIsRefreshingName(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: {
          action: "delete_phone",
          phone_number_id: phone.phone_number_id,
          db_id: phone.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Número excluído da Meta e do sistema!");
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
    } catch (err: any) {
      toast.error("Erro ao excluir número", { description: err.message });
    } finally {
      setIsDeleting(false);
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir número</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir permanentemente o número <strong>{phone.display_phone_number}</strong>? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Sincronizar nome de exibição (certificado) */}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs"
          disabled={isRefreshingName}
          onClick={() => handleRefreshName(false)}
        >
          <RefreshCw className={cn("mr-1.5 h-3 w-3", isRefreshingName && "animate-spin")} />
          Sincronizar nome
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={isRefreshingName}>
              Forçar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Forçar novo certificado</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai desregistrar e registrar novamente o número <strong>{phone.display_phone_number}</strong> na Cloud API (PIN 123456) para baixar o certificado com o nome aprovado. O número fica alguns segundos sem enviar mensagens.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleRefreshName(true)}>Forçar atualização</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
