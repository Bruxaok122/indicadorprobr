import { useState, useEffect } from "react";
import { Profile } from "@/types/juriszap";
import { WabaPhoneNumber } from "@/hooks/useWabaPhones";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhonePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile | null;
  phones: WabaPhoneNumber[];
  getUserPermissions: (userId: string) => Promise<string[]>;
  onSave: (params: { userId: string; phoneNumberIds: string[] }) => void;
  isSaving: boolean;
}

export function PhonePermissionsDialog({
  open,
  onOpenChange,
  user,
  phones,
  getUserPermissions,
  onSave,
  isSaving,
}: PhonePermissionsDialogProps) {
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);

  // Load current permissions when dialog opens
  useEffect(() => {
    if (open && user) {
      setIsLoadingPermissions(true);
      getUserPermissions(user.user_id)
        .then((ids) => setSelectedPhoneIds(ids))
        .catch(() => setSelectedPhoneIds([]))
        .finally(() => setIsLoadingPermissions(false));
    }
  }, [open, user]);

  const handleToggle = (phoneId: string) => {
    setSelectedPhoneIds((prev) =>
      prev.includes(phoneId)
        ? prev.filter((id) => id !== phoneId)
        : [...prev, phoneId]
    );
  };

  const handleSave = () => {
    if (!user) return;
    onSave({ userId: user.user_id, phoneNumberIds: selectedPhoneIds });
    onOpenChange(false);
  };

  const activePhones = phones.filter((p) => p.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Números de Disparo
          </DialogTitle>
          <DialogDescription>
            Defina quais números <strong>{user?.full_name}</strong> pode usar para
            realizar disparos
          </DialogDescription>
        </DialogHeader>

        {isLoadingPermissions ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" text="Carregando permissões..." />
          </div>
        ) : activePhones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Phone className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhum número disponível. Sincronize os números da Meta primeiro.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {activePhones.map((phone) => (
              <div
                key={phone.id}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handleToggle(phone.id)}
              >
                <Checkbox
                  checked={selectedPhoneIds.includes(phone.id)}
                  onCheckedChange={() => handleToggle(phone.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{phone.display_phone_number}</p>
                  {phone.verified_name && (
                    <p className="text-xs text-muted-foreground">{phone.verified_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoadingPermissions}
          >
            {isSaving ? (
              <>
                <LoadingSpinner size="sm" />
                Salvando...
              </>
            ) : (
              "Salvar Permissões"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
