import { Profile } from "@/types/juriszap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Zap, Phone, Radio, FileStack } from "lucide-react";

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Profile | null;
  onToggleApiPermission: (params: { userId: string; canUseSharedApi: boolean }) => void;
  onToggleManageNumbers: (params: { userId: string; canManageNumbers: boolean }) => void;
  onToggleDispatch: (params: { userId: string; canDispatch: boolean }) => void;
  onToggleCreateTemplates: (params: { userId: string; canCreateTemplates: boolean }) => void;
}

export function PermissionsDialog({
  open,
  onOpenChange,
  user,
  onToggleApiPermission,
  onToggleManageNumbers,
  onToggleDispatch,
  onToggleCreateTemplates,
}: PermissionsDialogProps) {
  if (!user) return null;

  const api = !!user.can_use_shared_api;
  const numbers = !!(user as any).can_manage_numbers;
  const dispatch = !!(user as any).can_dispatch;
  const templates = !!(user as any).can_create_templates;
  const allOn = api && numbers && dispatch && templates;

  const setAll = (checked: boolean) => {
    onToggleApiPermission({ userId: user.user_id, canUseSharedApi: checked });
    onToggleManageNumbers({ userId: user.user_id, canManageNumbers: checked });
    onToggleDispatch({ userId: user.user_id, canDispatch: checked });
    onToggleCreateTemplates({ userId: user.user_id, canCreateTemplates: checked });
  };

  const rows: {
    key: string;
    icon: any;
    label: string;
    desc: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }[] = [
    {
      key: "api",
      icon: Zap,
      label: "Usar API compartilhada",
      desc: "Permite usar a API do administrador",
      checked: api,
      onChange: (v) => onToggleApiPermission({ userId: user.user_id, canUseSharedApi: v }),
    },
    {
      key: "numbers",
      icon: Phone,
      label: "Gerenciar números",
      desc: "Adicionar e remover números WhatsApp",
      checked: numbers,
      onChange: (v) => onToggleManageNumbers({ userId: user.user_id, canManageNumbers: v }),
    },
    {
      key: "dispatch",
      icon: Radio,
      label: "Disparos",
      desc: "Realizar disparos em massa e avulsos",
      checked: dispatch,
      onChange: (v) => onToggleDispatch({ userId: user.user_id, canDispatch: v }),
    },
    {
      key: "templates",
      icon: FileStack,
      label: "Criar templates",
      desc: "Criar e gerenciar templates de mensagem",
      checked: templates,
      onChange: (v) => onToggleCreateTemplates({ userId: user.user_id, canCreateTemplates: v }),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Permissões do usuário</DialogTitle>
          <DialogDescription>
            {user.full_name} · {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div>
                <Label className="text-sm font-semibold">Todas as permissões</Label>
                <p className="text-xs text-muted-foreground">Liga ou desliga todas de uma vez</p>
              </div>
            </div>
            <Switch checked={allOn} onCheckedChange={setAll} />
          </div>

          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-sm">{r.label}</Label>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                </div>
                <Switch checked={r.checked} onCheckedChange={r.onChange} />
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
