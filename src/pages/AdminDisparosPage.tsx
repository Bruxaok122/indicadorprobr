import { useState, useEffect, useRef } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneNumberSelector } from "@/components/chat/PhoneNumberSelector";
import { Radio, Send, List, Mic, Upload, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const CONTACT_FIELD_OPTIONS = [
  { value: "name", label: "Nome do Cliente" },
  { value: "phone", label: "Telefone" },
  { value: "lawyer_name", label: "Nome do Advogado" },
  { value: "process_number", label: "Número do Processo" },
  { value: "cpf", label: "CPF" },
  { value: "valor_da_causa", label: "Valor da Causa" },
];

function extractVariables(text: string): number[] {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ""))))].sort((a, b) => a - b);
}

function getTemplateBody(template: MetaTemplate): string {
  if (template.components) {
    const body = (template.components as any[]).find((c: any) => c.type === "BODY");
    return body?.text || "";
  }
  return "";
}

interface ContactList {
  name: string;
  count: number;
}

export default function AdminDisparosPage() {
  const { users } = useAdmin();
  const { allTemplates, sendBulk, isSendingBulk } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const queryClient = useQueryClient();
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isDeletingAudio, setIsDeletingAudio] = useState(false);

  // List-based selection
  const [selectedList, setSelectedList] = useState<string>("");
  const [availableLists, setAvailableLists] = useState<ContactList[]>([]);
  const [listContactCount, setListContactCount] = useState(0);
  const [loadingLists, setLoadingLists] = useState(false);

  // Fetch configured audio
  const { data: audioConfig, isLoading: loadingAudio } = useQuery({
    queryKey: ["admin-audio-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audio_config" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { id: string; audio_url: string; audio_name: string } | null;
    },
  });

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Load available lists from admin pool contacts
  useEffect(() => {
    setLoadingLists(true);
    supabase
      .from("contacts")
      .select("*")
      .is("user_id", null)
      .then(({ data }) => {
        if (!data) { setLoadingLists(false); return; }
        const map: Record<string, number> = {};
        (data as any[]).forEach((c) => {
          const listName = c.contact_list;
          if (!listName) return;
          map[listName] = (map[listName] || 0) + 1;
        });
        const lists = Object.entries(map).map(([name, count]) => ({ name, count }));
        setAvailableLists(lists);
        setLoadingLists(false);
      });
  }, []);

  // Update contact count when list changes
  useEffect(() => {
    if (!selectedList) { setListContactCount(0); return; }
    const found = availableLists.find((l) => l.name === selectedList);
    setListContactCount(found?.count || 0);
  }, [selectedList, availableLists]);

  // Auto-detect variables when template changes
  useEffect(() => {
    if (!selectedTemplate) { setVariableMappings({}); return; }
    const body = getTemplateBody(selectedTemplate);
    const vars = extractVariables(body);
    const defaults: Record<string, string> = {};
    vars.forEach((v, i) => {
      if (i === 0) defaults[String(v)] = "name";
      else if (i === 1) defaults[String(v)] = "process_number";
    });
    setVariableMappings(defaults);
  }, [selectedTemplate]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Selecione um arquivo de áudio válido");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }
    setIsUploadingAudio(true);
    try {
      const filePath = `audio/admin-config/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
      const audioUrl = urlData.publicUrl;

      // Delete previous config if exists
      if (audioConfig?.id) {
        await supabase.from("admin_audio_config" as any).delete().eq("id", audioConfig.id);
      }

      const { error: insertError } = await supabase.from("admin_audio_config" as any).insert({
        audio_url: audioUrl,
        audio_name: file.name,
      });
      if (insertError) throw insertError;

      toast.success("Áudio configurado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-audio-config"] });
    } catch (err: any) {
      toast.error("Erro ao salvar áudio", { description: err.message });
    } finally {
      setIsUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  const handleDeleteAudio = async () => {
    if (!audioConfig?.id) return;
    setIsDeletingAudio(true);
    try {
      await supabase.from("admin_audio_config" as any).delete().eq("id", audioConfig.id);
      toast.success("Áudio removido");
      queryClient.invalidateQueries({ queryKey: ["admin-audio-config"] });
    } catch (err: any) {
      toast.error("Erro ao remover áudio", { description: err.message });
    } finally {
      setIsDeletingAudio(false);
    }
  };

  const approvedTemplates = allTemplates.filter((t) => t.status === "APPROVED");

  const handleSend = async () => {
    if (!selectedTemplate || !selectedList) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    // Fetch contact IDs for the selected list
    const { data, error } = await (supabase as any)
      .from("contacts")
      .select("id")
      .is("user_id", null)
      .eq("contact_list", selectedList);

    if (error || !data || data.length === 0) {
      toast.error("Nenhum contato encontrado na lista selecionada");
      return;
    }

    const contactIds = (data as any[]).map((c) => c.id);

    sendBulk({
      contactIds,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language,
      selectedPhoneNumberId: selectedPhoneNumberId || undefined,
      variableMappings,
      targetUserId: selectedUserId || undefined,
    });
  };

  const templateBody = selectedTemplate ? getTemplateBody(selectedTemplate) : "";
  const templateVars = extractVariables(templateBody);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Disparos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o template, a lista de contatos e dispare mensagens personalizadas.
        </p>
      </div>

      {/* Audio config card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            Áudio de Voz dos Operadores
          </CardTitle>
          <CardDescription>
            Configure o arquivo de áudio que os operadores enviarão com um clique nas conversas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAudioUpload}
          />
          {loadingAudio ? (
            <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
          ) : audioConfig ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{audioConfig.audio_name}</p>
                  <p className="text-xs text-muted-foreground">Áudio configurado · clique para substituir</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isUploadingAudio}
                >
                  {isUploadingAudio ? <LoadingSpinner size="sm" /> : <Upload className="h-3.5 w-3.5" />}
                  Substituir
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={handleDeleteAudio}
                  disabled={isDeletingAudio}
                >
                  {isDeletingAudio ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
              <Mic className="h-8 w-8 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum áudio configurado</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Os operadores não terão o botão de áudio habilitado.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => audioInputRef.current?.click()}
                disabled={isUploadingAudio}
              >
                {isUploadingAudio ? <LoadingSpinner size="sm" /> : <Upload className="h-4 w-4" />}
                Carregar Áudio
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Step 1: Template */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              Template
            </CardTitle>
            <CardDescription>Template aprovado pela Meta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              value={selectedTemplate?.name || ""}
              onValueChange={(name) => {
                const t = approvedTemplates.find((t) => t.name === name);
                setSelectedTemplate(t || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o template..." />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplate && templateBody && (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {templateBody}
              </div>
            )}

            {templateVars.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Variáveis personalizadas</p>
                {templateVars.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">{`{{${v}}}`}</Badge>
                    <Select
                      value={variableMappings[String(v)] || ""}
                      onValueChange={(val) => setVariableMappings((prev) => ({ ...prev, [String(v)]: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Campo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {phones.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Número de disparo</p>
                <PhoneNumberSelector
                  phones={phones}
                  selectedPhoneNumberId={selectedPhoneNumberId}
                  onSelect={setSelectedPhoneNumberId}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              Lista de Contatos
            </CardTitle>
            <CardDescription>
              {selectedList && listContactCount > 0
                ? `${listContactCount} contato(s) serão disparados`
                : "Selecione a lista de contatos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingLists ? (
              <div className="flex justify-center py-6"><LoadingSpinner size="sm" /></div>
            ) : availableLists.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <List className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma lista disponível</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Importe contatos na aba Contatos</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {availableLists.map((list) => (
                  <button
                    key={list.name}
                    onClick={() => setSelectedList(list.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                      selectedList === list.name
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{list.name}</span>
                    <Badge variant={selectedList === list.name ? "default" : "secondary"} className="text-xs">
                      {list.count} contatos
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Responsible + Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              Responsável pelas respostas
            </CardTitle>
            <CardDescription>Quem atenderá os clientes após o disparo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o usuário..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__admin__">Administrador</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se nenhum usuário for selecionado, o contato ficará sem responsável.
            </p>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-3 space-y-1.5 mt-2">
              <p className="text-xs font-medium">Resumo do disparo</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Template:</span>
                <span className="font-medium truncate max-w-[140px]">{selectedTemplate?.name || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Lista:</span>
                <span className="font-medium truncate max-w-[140px]">{selectedList || "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Contatos:</span>
                <span className="font-medium">{listContactCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Responsável:</span>
                <span className="font-medium">
                  {selectedUserId === "__admin__" ? "Administrador" : users.find(u => u.user_id === selectedUserId)?.full_name || "—"}
                </span>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSend}
              disabled={
                !selectedTemplate ||
                !selectedList ||
                listContactCount === 0 ||
                isSendingBulk ||
                (phones.length > 0 && !selectedPhoneNumberId)
              }
            >
              {isSendingBulk ? (
                <><LoadingSpinner size="sm" /> Disparando...</>
              ) : (
                <><Send className="h-4 w-4" /> Disparar para {listContactCount} contato{listContactCount !== 1 ? "s" : ""}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
