import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Copy, CheckCircle, ExternalLink, Webhook, Key, Link } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WebhookPage() {
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Get the Supabase project URL from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const projectId = supabaseUrl.split("//")[1]?.split(".")[0] || "[SEU-PROJETO]";
  
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/whatsapp-webhook`;
  const verifyToken = "juriszap_webhook";

  const copyToClipboard = async (text: string, type: "webhook" | "token") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "webhook") {
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
      toast.success("Copiado para a área de transferência!");
    } catch (err) {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Webhook do WhatsApp"
          description="Configure estas informações no Meta Developers"
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            <AlertBanner type="success" title="Webhook Configurado">
              Seu webhook está pronto para receber mensagens do WhatsApp. Configure as
              informações abaixo no Meta Developers para ativar.
            </AlertBanner>

            {/* Webhook URL Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link className="h-5 w-5 text-accent" />
                  <CardTitle>Webhook URL (Callback URL)</CardTitle>
                </div>
                <CardDescription>
                  Copie esta URL e cole no campo "Callback URL" do Meta Developers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border bg-muted p-4">
                    <code className="break-all text-sm font-mono">{webhookUrl}</code>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookUrl, "webhook")}
                  >
                    {copiedWebhook ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Verify Token Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-accent" />
                  <CardTitle>Verify Token</CardTitle>
                </div>
                <CardDescription>
                  Copie este token e cole no campo "Verify Token" do Meta Developers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border bg-muted p-4">
                    <code className="text-lg font-mono font-bold text-primary">
                      {verifyToken}
                    </code>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(verifyToken, "token")}
                  >
                    {copiedToken ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Instructions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Como Configurar no Meta Developers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="list-inside list-decimal space-y-3 text-sm text-muted-foreground">
                  <li>
                    Acesse{" "}
                    <a
                      href="https://developers.facebook.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:no-underline"
                    >
                      developers.facebook.com
                      <ExternalLink className="ml-1 inline h-3 w-3" />
                    </a>
                  </li>
                  <li>Selecione seu App do WhatsApp Business</li>
                  <li>
                    Vá em <strong>WhatsApp → Configuração</strong>
                  </li>
                  <li>
                    Na seção <strong>Webhooks</strong>, clique em{" "}
                    <strong>Editar</strong> ou <strong>Configurar</strong>
                  </li>
                  <li>
                    Cole a <strong>Callback URL</strong> copiada acima
                  </li>
                  <li>
                    Cole o <strong>Verify Token</strong> (juriszap_webhook)
                  </li>
                  <li>
                    Clique em <strong>Verificar e Salvar</strong>
                  </li>
                  <li>
                    Marque a opção <strong>messages</strong> para receber mensagens
                  </li>
                </ol>

                <div className="mt-6 rounded-lg bg-accent/10 p-4">
                  <h4 className="mb-2 font-semibold text-accent">Campos para Assinar</h4>
                  <p className="text-sm text-muted-foreground">
                    Certifique-se de assinar pelo menos estes campos de webhook:
                  </p>
                  <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                    <li>
                      <code className="rounded bg-muted px-1">messages</code> - para receber
                      mensagens
                    </li>
                    <li>
                      <code className="rounded bg-muted px-1">message_status</code> - para
                      atualizações de status (enviado, entregue, lido)
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Testing Card */}
            <Card>
              <CardHeader>
                <CardTitle>Testando a Conexão</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>
                  Após configurar o webhook no Meta Developers:
                </p>
                <ol className="mt-3 list-inside list-decimal space-y-2">
                  <li>Envie uma mensagem de teste do seu WhatsApp para o número configurado</li>
                  <li>
                    A mensagem deve aparecer automaticamente na aba <strong>Conversas</strong>{" "}
                    deste sistema
                  </li>
                  <li>
                    Se não aparecer, verifique se todos os passos foram seguidos corretamente
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
