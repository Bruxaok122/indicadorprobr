import { useState, useEffect, useRef } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useMetaTemplates, MetaTemplate } from "@/hooks/useMetaTemplates";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PhoneNumberSelector } from "@/components/chat/PhoneNumberSelector";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Radio, Send, List, Layers, Pause, Play, XCircle, Timer, User } from "lucide-react";
import { toast } from "sonner";

const CONTACT_FIELD_OPTIONS = [
  { value: "name", label: "Nome do Cliente", defaultHint: "" },
  { value: "advogado", label: "Nome do Advogado (Nº Disparo)", defaultHint: "" },
  { value: "phone", label: "Telefone", defaultHint: "" },
  { value: "lawyer_name", label: "Parte Contrária", defaultHint: "Padrão: ********" },
  { value: "process_number", label: "Número do Processo", defaultHint: "Padrão: 0031486-26.2025.8.26.0002" },
  { value: "cpf", label: "CPF", defaultHint: "" },
  { value: "valor_da_causa", label: "Valor da Causa", defaultHint: "" },
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

type DispatchMode = "batch" | "individual";

export default function AdminDisparosPage() {
  const { users } = useAdmin();
  const { allTemplates } = useMetaTemplates();
  const { phones } = useWabaPhones();
  const { user } = useAuthContext();

  // Step 1: Phone
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState("");

  // Step 2: Template
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [variableMappings, setVariableMappings] = useState<Record<string, string>>({});

  // Step 3: List + dispatch mode
  const [selectedList, setSelectedList] = useState<string>("");
  const [availableLists, setAvailableLists] = useState<ContactList[]>([]);
  const [listContactCount, setListContactCount] = useState(0);
  const [loadingLists, setLoadingLists] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>("batch");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [intervalSeconds, setIntervalSeconds] = useState(5);

  // Step 4: Responsible
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Dispatch control
  const [isDispatching, setIsDispatching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState({ current: 0, total: 0, sent: 0, failed: 0, errors: [] as string[] });
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // Phone data for advogado variable
  const selectedPhoneData = phones.find(p => p.phone_number_id === selectedPhoneNumberId);
  const phoneVerifiedName = selectedPhoneData?.verified_name || selectedPhoneData?.lawyer_name || "";

  // Auto-select phone
  useEffect(() => {
    if (phones.length === 1 && !selectedPhoneNumberId) {
      setSelectedPhoneNumberId(phones[0].phone_number_id);
    }
  }, [phones, selectedPhoneNumberId]);

  // Load available lists
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

  const approvedTemplates = allTemplates.filter((t) => t.status === "APPROVED");
  const templateBody = selectedTemplate ? getTemplateBody(selectedTemplate) : "";
  const templateVars = extractVariables(templateBody);

  const refreshLists = () => {
    supabase
      .from("contacts")
      .select("*")
      .is("user_id", null)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        (data as any[]).forEach((c) => {
          const listName = c.contact_list;
          if (!listName) return;
          map[listName] = (map[listName] || 0) + 1;
        });
        const lists = Object.entries(map).map(([name, count]) => ({ name, count }));
        setAvailableLists(lists);
        const found = lists.find((l) => l.name === selectedList);
        setListContactCount(found?.count || 0);
        if (found && found.count === 0) setSelectedList("");
      });
  };

  const effectiveCount = batchMode ? Math.min(batchSize, listContactCount) : listContactCount;

  const handleSend = async () => {
    if (!selectedTemplate || !selectedList || !selectedUserId) return;
    if (phones.length > 0 && !selectedPhoneNumberId) {
      toast.error("Selecione um número de disparo");
      return;
    }

    const { data, error } = await (supabase as any)
      .from("contacts")
      .select("id")
      .is("user_id", null)
      .eq("contact_list", selectedList);

    if (error || !data || data.length === 0) {
      toast.error("Nenhum contato encontrado na lista selecionada");
      return;
    }

    let contactIds = (data as any[]).map((c) => c.id);
    if (batchMode) contactIds = contactIds.slice(0, batchSize);

    setIsDispatching(true);
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setIsPaused(false);

    const results = { current: 0, total: contactIds.length, sent: 0, failed: 0, errors: [] as string[] };
    setDispatchProgress({ ...results });

    try {
      if (dispatchMode === "individual") {
        for (let i = 0; i < contactIds.length; i++) {
          while (isPausedRef.current && !isCancelledRef.current) {
            await new Promise(r => setTimeout(r, 500));
          }
          if (isCancelledRef.current) break;

          toast.info(`Enviando ${i + 1}/${contactIds.length}...`, { id: "bulk-progress" });

          const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
            body: {
              contactIds: [contactIds[i]],
              templateName: selectedTemplate.name,
              templateLanguage: selectedTemplate.language,
              userId: selectedUserId,
              selectedPhoneNumberId: selectedPhoneNumberId || undefined,
              variableMappings,
              phoneVerifiedName,
            },
          });

          if (!sendError && result?.results) {
            results.sent += result.results.sent || 0;
            results.failed += result.results.failed || 0;
            if (result.results.errors) results.errors.push(...result.results.errors);
          } else {
            results.failed++;
            if (sendError) results.errors.push(sendError.message);
          }

          results.current = i + 1;
          setDispatchProgress({ ...results });

          // Wait interval between sends
          if (i < contactIds.length - 1 && !isCancelledRef.current) {
            for (let s = 0; s < intervalSeconds * 2; s++) {
              if (isCancelledRef.current) break;
              while (isPausedRef.current && !isCancelledRef.current) {
                await new Promise(r => setTimeout(r, 500));
              }
              if (isCancelledRef.current) break;
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }
      } else {
        // Batch mode
        const CHUNK = 50;
        const totalChunks = Math.ceil(contactIds.length / CHUNK);

        for (let i = 0; i < contactIds.length; i += CHUNK) {
          while (isPausedRef.current && !isCancelledRef.current) {
            await new Promise(r => setTimeout(r, 500));
          }
          if (isCancelledRef.current) break;

          const chunk = contactIds.slice(i, i + CHUNK);
          const chunkNum = Math.floor(i / CHUNK) + 1;
          toast.info(`Enviando lote ${chunkNum}/${totalChunks}...`, { id: "bulk-progress" });

          const { data: result, error: sendError } = await supabase.functions.invoke("send-bulk-template", {
            body: {
              contactIds: chunk,
              templateName: selectedTemplate.name,
              templateLanguage: selectedTemplate.language,
              userId: selectedUserId,
              selectedPhoneNumberId: selectedPhoneNumberId || undefined,
              variableMappings,
              phoneVerifiedName,
            },
          });

          if (!sendError && result?.results) {
            results.sent += result.results.sent || 0;
            results.failed += result.results.failed || 0;
            if (result.results.errors) results.errors.push(...result.results.errors);
          }

          results.current = Math.min(i + CHUNK, contactIds.length);
          setDispatchProgress({ ...results });
        }
      }

      if (isCancelledRef.current) {
        toast.warning(`Disparo cancelado: ${results.sent} enviados, ${results.failed} falhas`, { id: "bulk-progress" });
      } else {
        toast.success(`Disparo concluído: ${results.sent} enviados, ${results.failed} falhas`, { id: "bulk-progress" });
      }
    } catch (err: any) {
      toast.error("Erro no disparo", { description: err.message, id: "bulk-progress" });
    } finally {
      setIsDispatching(false);
      refreshLists();
    }
  };

  const handlePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(!isPaused);
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsPaused(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          Disparos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o número, template, lista e dispare mensagens personalizadas.
        </p>
      </div>

      {/* Dispatch Progress Overlay */}
      {isDispatching && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {isPaused ? "⏸️ Disparo pausado" : `📤 Disparando ${dispatchMode === "individual" ? "individualmente" : "em lote"}...`}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handlePause} className="gap-1.5">
                  {isPaused ? <><Play className="h-3.5 w-3.5" /> Retomar</> : <><Pause className="h-3.5 w-3.5" /> Pausar</>}
                </Button>
                <Button size="sm" variant="destructive" onClick={handleCancel} className="gap-1.5">
                  <XCircle className="h-3.5 w-3.5" /> Cancelar
                </Button>
              </div>
            </div>
            <Progress value={dispatchProgress.total > 0 ? (dispatchProgress.current / dispatchProgress.total) * 100 : 0} className="h-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Progresso: {dispatchProgress.current}/{dispatchProgress.total}</span>
              <span className="text-green-600">✓ {dispatchProgress.sent} enviados</span>
              {dispatchProgress.failed > 0 && <span className="text-destructive">✗ {dispatchProgress.failed} falhas</span>}
            </div>
            {dispatchProgress.errors.length > 0 && (
              <div className="max-h-24 overflow-y-auto rounded border p-2 text-xs text-destructive space-y-0.5">
                {dispatchProgress.errors.slice(-5).map((err, i) => <p key={i}>{err}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Phone + Template */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              Número e Template
            </CardTitle>
            <CardDescription>Selecione o número de disparo e o template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phone number selector */}
            {phones.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Número de disparo</p>
                <PhoneNumberSelector
                  phones={phones}
                  selectedPhoneNumberId={selectedPhoneNumberId}
                  onSelect={setSelectedPhoneNumberId}
                />
                {phoneVerifiedName && (
                  <p className="text-xs text-primary mt-1.5">👨‍⚖️ Advogado: <span className="font-semibold">{phoneVerifiedName}</span></p>
                )}
              </div>
            )}

            {/* Template selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Template aprovado pela Meta</p>
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
            </div>

            {selectedTemplate && templateBody && (
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {templateBody}
              </div>
            )}

            {templateVars.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Variáveis personalizadas</p>
                {templateVars.map((v) => {
                  const selectedField = CONTACT_FIELD_OPTIONS.find(opt => opt.value === variableMappings[String(v)]);
                  const isAdvogado = variableMappings[String(v)] === "advogado";
                  return (
                    <div key={v} className="space-y-1">
                      <div className="flex items-center gap-2">
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
                      {isAdvogado && phoneVerifiedName && (
                        <p className="text-[10px] text-primary ml-14">→ {phoneVerifiedName}</p>
                      )}
                      {selectedField?.defaultHint && !isAdvogado && (
                        <p className="text-[10px] text-muted-foreground ml-14">{selectedField.defaultHint}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: List + Dispatch Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              Lista e Modo de Disparo
            </CardTitle>
            <CardDescription>
              {selectedList && listContactCount > 0
                ? `${effectiveCount} contato(s) serão disparados`
                : "Selecione a lista e o modo de envio"}
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
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
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

            {/* Dispatch mode selection */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Modo de disparo</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDispatchMode("batch")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    dispatchMode === "batch" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  <Layers className="h-4 w-4 mx-auto mb-1" />
                  Lote
                </button>
                <button
                  onClick={() => setDispatchMode("individual")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    dispatchMode === "individual" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  <Timer className="h-4 w-4 mx-auto mb-1" />
                  Individual
                </button>
              </div>

              {dispatchMode === "individual" && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="interval" className="text-xs text-muted-foreground whitespace-nowrap">Intervalo:</Label>
                  <Input
                    id="interval"
                    type="number"
                    min={1}
                    max={300}
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-8 w-20 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">segundos</span>
                </div>
              )}

              {dispatchMode === "batch" && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div>
                        <Label htmlFor="batch-mode" className="text-xs font-medium cursor-pointer">Modo lote limitado</Label>
                        <p className="text-[10px] text-muted-foreground">Limita quantidade por disparo</p>
                      </div>
                    </div>
                    <Switch id="batch-mode" checked={batchMode} onCheckedChange={setBatchMode} />
                  </div>
                  {batchMode && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="batch-size" className="text-xs text-muted-foreground whitespace-nowrap">Quantidade:</Label>
                      <Input
                        id="batch-size"
                        type="number"
                        min={1}
                        max={listContactCount || 9999}
                        value={batchSize}
                        onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 w-24 text-sm"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 3: Responsible + Summary + Send */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
            Responsável e Envio
          </CardTitle>
          <CardDescription>Quem atenderá os clientes após o disparo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o operador..." />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.user_id !== user?.id)
                    .map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione o operador que atenderá os clientes.
              </p>
            </div>

            <div className="space-y-3">
              {/* Summary */}
              <div className="rounded-lg bg-muted p-3 space-y-1.5">
                <p className="text-xs font-medium">Resumo do disparo</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Número:</span>
                  <span className="font-medium truncate max-w-[180px]">{selectedPhoneData?.display_phone_number || "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium truncate max-w-[180px]">{selectedTemplate?.name || "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Lista:</span>
                  <span className="font-medium truncate max-w-[180px]">{selectedList || "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Contatos:</span>
                  <span className="font-medium">
                    {batchMode ? `${Math.min(batchSize, listContactCount)} de ${listContactCount}` : listContactCount}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Modo:</span>
                  <Badge variant="outline" className="text-xs">
                    {dispatchMode === "individual" ? `Individual (${intervalSeconds}s)` : batchMode ? `Lote de ${batchSize}` : "Lote completo"}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Responsável:</span>
                  <span className="font-medium">
                    {users.find(u => u.user_id === selectedUserId)?.full_name || "—"}
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
                  !selectedUserId ||
                  listContactCount === 0 ||
                  isDispatching ||
                  (phones.length > 0 && !selectedPhoneNumberId)
                }
              >
                {isDispatching ? (
                  <><LoadingSpinner size="sm" /> Disparando...</>
                ) : (
                  <><Send className="h-4 w-4" /> Disparar para {effectiveCount} contato{effectiveCount !== 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
