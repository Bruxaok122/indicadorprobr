import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Eye, EyeOff, CheckCircle, AlertCircle, HelpCircle, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ConfiguracaoPage() {
  const { config, isLoading, isConfigured, validate, isValidating } = useWhatsAppConfig();

  const [accessToken, setAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleValidate = () => {
    if (!accessToken || !wabaId || !phoneNumberId) {
      return;
    }
    validate({ accessToken, wabaId, phoneNumberId });
  };

  const isFormValid = accessToken.length > 0 && wabaId.length > 0 && phoneNumberId.length > 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-screen items-center justify-center">
          <LoadingSpinner size="lg" text="Carregando configuração..." />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Configuração do WhatsApp"
          description="Configure sua conexão com a API do WhatsApp Business"
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Status Banner */}
            {isConfigured ? (
              <AlertBanner type="success" title="Conexão Ativa">
                Sua conta do WhatsApp Business está conectada e funcionando corretamente.
              </AlertBanner>
            ) : (
              <AlertBanner type="warning" title="Configuração Necessária">
                Configure sua API do WhatsApp para começar a enviar mensagens.
              </AlertBanner>
            )}

            {/* Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle>Credenciais da API</CardTitle>
                <CardDescription>
                  Obtenha estas informações no{" "}
                  <a
                    href="https://developers.facebook.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:no-underline"
                  >
                    Meta Developers
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Access Token */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          Token de acesso da sua conta. Encontre em: Meta Developers → Seu App →
                          WhatsApp → Configuração da API.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <Input
                      id="accessToken"
                      type={showToken ? "text" : "password"}
                      placeholder="EAAxxxxxxxx..."
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* WABA ID */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="wabaId">WABA ID (ID da Conta Business)</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          ID da sua conta WhatsApp Business. Encontre em: Meta Business Suite →
                          Configurações → Contas do WhatsApp.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="wabaId"
                    type="text"
                    placeholder="123456789012345"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                  />
                </div>

                {/* Phone Number ID */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          ID do número de telefone registrado. Encontre em: Meta Developers → Seu
                          App → WhatsApp → Configuração da API → Phone Number ID.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="phoneNumberId"
                    type="text"
                    placeholder="123456789012345"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                  />
                </div>

                {/* Validate Button */}
                <Button
                  onClick={handleValidate}
                  disabled={!isFormValid || isValidating}
                  className="w-full"
                  size="lg"
                >
                  {isValidating ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Validando conexão...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Validar Conexão
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Como obter as credenciais?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ol className="list-inside list-decimal space-y-2">
                  <li>
                    Acesse{" "}
                    <a
                      href="https://developers.facebook.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      developers.facebook.com
                    </a>
                  </li>
                  <li>Crie ou selecione seu app de WhatsApp Business</li>
                  <li>Vá em WhatsApp → Configuração da API</li>
                  <li>Copie o Access Token (pode ser temporário ou permanente)</li>
                  <li>Anote o Phone Number ID exibido na página</li>
                  <li>
                    O WABA ID está em: Meta Business Suite → Configurações → Contas do WhatsApp
                  </li>
                </ol>
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <p className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                    <span>
                      <strong>Importante:</strong> Tokens temporários expiram em 24 horas. Para uso
                      em produção, gere um token permanente.
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
