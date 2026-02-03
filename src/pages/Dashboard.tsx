import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { useContacts } from "@/hooks/useContacts";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Circle,
  MessageSquare,
  Users,
  Settings,
  Upload,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";

export default function Dashboard() {
  const { isConfigured, isLoading: configLoading } = useWhatsAppConfig();
  const { contacts, isLoading: contactsLoading } = useContacts();

  const stats = {
    total: contacts.length,
    novos: contacts.filter((c) => c.status === "novo").length,
    aguardando: contacts.filter((c) => c.status === "aguardando").length,
    respondidos: contacts.filter((c) => c.status === "respondido").length,
  };

  const steps = [
    {
      title: "Configurar WhatsApp API",
      description: "Conecte sua conta do WhatsApp Business",
      completed: isConfigured,
      href: "/configuracao",
      icon: Settings,
    },
    {
      title: "Importar Contatos",
      description: "Importe sua lista jurídica de clientes",
      completed: contacts.length > 0,
      href: "/importar",
      icon: Upload,
    },
    {
      title: "Enviar Mensagens",
      description: "Comece a se comunicar com seus clientes",
      completed: false,
      href: "/conversas",
      icon: MessageSquare,
    },
  ];

  const recentContacts = contacts.slice(0, 5);

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Painel de Controle"
          description="Gerencie suas comunicações jurídicas via WhatsApp"
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Status Alert */}
            {!isConfigured && !configLoading && (
              <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">Configuração Pendente</p>
                  <p className="text-sm text-muted-foreground">
                    Configure sua API do WhatsApp para começar a enviar mensagens.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/configuracao">Configurar Agora</Link>
                </Button>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total de Contatos</CardDescription>
                  <CardTitle className="text-3xl">{stats.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    to="/contatos"
                    className="text-sm text-primary hover:underline"
                  >
                    Ver todos →
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Novos</CardDescription>
                  <CardTitle className="text-3xl text-info">{stats.novos}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Aguardando primeiro contato</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Aguardando Resposta</CardDescription>
                  <CardTitle className="text-3xl text-warning">{stats.aguardando}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Mensagem enviada</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Respondidos</CardDescription>
                  <CardTitle className="text-3xl text-success">{stats.respondidos}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Cliente respondeu</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Setup Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-accent" />
                    Passos para Começar
                  </CardTitle>
                  <CardDescription>
                    Siga estes passos para configurar seu sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {steps.map((step, index) => (
                    <Link
                      key={step.href}
                      to={step.href}
                      className={cn(
                        "flex items-center gap-4 rounded-lg border p-4 transition-colors",
                        step.completed
                          ? "border-success/30 bg-success/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          step.completed
                            ? "bg-success text-success-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {step.completed ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <span className="text-sm font-medium">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Contacts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-accent" />
                    Contatos Recentes
                  </CardTitle>
                  <CardDescription>Últimos contatos adicionados ou atualizados</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="mb-2 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum contato ainda
                      </p>
                      <Button asChild variant="link" size="sm" className="mt-2">
                        <Link to="/importar">Importar lista jurídica</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentContacts.map((contact) => (
                        <Link
                          key={contact.id}
                          to={`/conversas?contact=${contact.id}`}
                          className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div>
                            <p className="font-medium text-foreground">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {contact.process_number || "Sem processo"}
                            </p>
                          </div>
                          <StatusBadge status={contact.status} />
                        </Link>
                      ))}
                      <Button asChild variant="outline" className="w-full">
                        <Link to="/contatos">Ver todos os contatos</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
