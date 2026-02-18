import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Send } from "lucide-react";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    category: string;
    language: string;
    bodyText: string;
    headerText?: string;
  }) => void;
  isSubmitting: boolean;
}

export function CreateTemplateDialog({ open, onOpenChange, onSubmit, isSubmitting }: CreateTemplateDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("pt_BR");
  const [bodyText, setBodyText] = useState("");
  const [headerText, setHeaderText] = useState("");

  const handleSubmit = () => {
    if (!name || !bodyText) return;
    onSubmit({
      name: name.toLowerCase().replace(/\s+/g, "_"),
      category,
      language,
      bodyText,
      headerText: headerText || undefined,
    });
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setName("");
      setCategory("UTILITY");
      setLanguage("pt_BR");
      setBodyText("");
      setHeaderText("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Novo Template</DialogTitle>
          <DialogDescription>
            O template será enviado para análise da Meta. Após aprovação, poderá ser usado para disparos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Template</Label>
            <Input
              placeholder="ex: boas_vindas_cliente"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            />
            <p className="text-xs text-muted-foreground">
              Apenas letras minúsculas, números e underscores (_)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utilidade</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cabeçalho (opcional)</Label>
            <Input
              placeholder="Texto do cabeçalho"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label>Corpo da Mensagem</Label>
            <Textarea
              placeholder="Olá {{1}}, seja bem-vindo! Estamos à disposição para ajudá-lo."
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={5}
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{1}}"} para nome do cliente, {"{{2}}"} para nº do processo, etc. Máx. 1024 caracteres.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Exemplo: "Olá {"{{1}}"}, entramos em contato sobre o processo {"{{2}}"}."
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !bodyText || isSubmitting}>
            {isSubmitting ? (
              <><LoadingSpinner size="sm" /> Enviando...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Enviar para Análise</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
