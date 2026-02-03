import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertBanner } from "@/components/ui/alert-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageTemplate } from "@/types/juriszap";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  X,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("utility");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (template: { name: string; content: string; category: string }) => {
      const { error } = await supabase.from("message_templates").insert({
        name: template.name,
        content: template.content,
        category: template.category,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setShowAddDialog(false);
      setNewName("");
      setNewContent("");
      setNewCategory("utility");
    },
    onError: (error: any) => {
      toast.error("Erro ao criar template", { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template removido!");
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao remover", { description: error.message });
    },
  });

  const handleAdd = () => {
    if (!newName.trim() || !newContent.trim()) return;
    addMutation.mutate({
      name: newName.trim(),
      content: newContent.trim(),
      category: newCategory,
    });
  };

  const getStatusIcon = (status: MessageTemplate["status"]) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "rejected":
        return <X className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusText = (status: MessageTemplate["status"]) => {
    switch (status) {
      case "approved":
        return "Aprovado";
      case "pending":
        return "Aguardando aprovação";
      case "rejected":
        return "Rejeitado";
    }
  };

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Templates de Mensagem"
          description="Gerencie seus modelos de mensagem aprovados"
        >
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Template</DialogTitle>
                <DialogDescription>
                  Templates precisam ser aprovados pela Meta antes de serem usados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Template</Label>
                  <Input
                    id="name"
                    placeholder="Ex: notificacao_audiencia"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use apenas letras minúsculas, números e underscores
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utility">Utilidade</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="authentication">Autenticação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">Conteúdo da Mensagem</Label>
                  <Textarea
                    id="content"
                    placeholder="Prezado(a) {{1}}, informamos que sua audiência..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="min-h-[150px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis dinâmicas
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!newName.trim() || !newContent.trim() || addMutation.isPending}
                >
                  {addMutation.isPending ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Criando...
                    </>
                  ) : (
                    "Criar Template"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageHeader>

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <AlertBanner type="info" title="Sobre Templates">
              <p>
                Templates são modelos de mensagem pré-aprovados pela Meta. Para enviar a primeira
                mensagem a um cliente, você precisa usar um template aprovado. Após o cliente
                responder, você pode enviar mensagens livres por 24 horas.
              </p>
            </AlertBanner>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" text="Carregando templates..." />
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Nenhum template cadastrado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Crie seu primeiro template para começar a enviar mensagens
                  </p>
                  <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg font-mono">{template.name}</CardTitle>
                          <CardDescription>
                            Categoria: {template.category} • Idioma: {template.language}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                              template.status === "approved" &&
                                "bg-success/10 text-success",
                              template.status === "pending" &&
                                "bg-warning/10 text-warning",
                              template.status === "rejected" &&
                                "bg-destructive/10 text-destructive"
                            )}
                          >
                            {getStatusIcon(template.status)}
                            {getStatusText(template.status)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteMutation.mutate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg bg-muted p-4">
                        <p className="whitespace-pre-wrap text-sm">{template.content}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
