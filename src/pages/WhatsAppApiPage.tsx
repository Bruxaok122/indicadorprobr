import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Phone, UserCircle, Send, CheckCircle, RefreshCw, Wifi, WifiOff, AlertCircle, Upload, Image, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWabaPhones } from "@/hooks/useWabaPhones";
import { useAuthContext } from "@/contexts/AuthContext";

interface PhoneStatus {
  id: string;
  status?: string;
  code_verification_status?: string;
  quality_rating?: string;
  name_status?: string;
  loading: boolean;
}

const VERTICALS = [
  { value: "UNDEFINED", label: "Não definido" },
  { value: "OTHER", label: "Outro" },
  { value: "AUTO", label: "Automotivo" },
  { value: "BEAUTY", label: "Beleza" },
  { value: "APPAREL", label: "Vestuário" },
  { value: "EDU", label: "Educação" },
  { value: "ENTERTAIN", label: "Entretenimento" },
  { value: "EVENT_PLAN", label: "Eventos" },
  { value: "FINANCE", label: "Finanças" },
  { value: "GROCERY", label: "Alimentos" },
  { value: "GOVT", label: "Governo" },
  { value: "HOTEL", label: "Hotelaria" },
  { value: "HEALTH", label: "Saúde" },
  { value: "NONPROFIT", label: "ONG" },
  { value: "PROF_SERVICES", label: "Serviços profissionais" },
  { value: "RETAIL", label: "Varejo" },
  { value: "TRAVEL", label: "Viagens" },
  { value: "RESTAURANT", label: "Restaurante" },
  { value: "NOT_A_BIZ", label: "Não é empresa" },
];

function getStatusInfo(status?: string) {
  switch (status) {
    case "CONNECTED":
      return { label: "Conectado", variant: "default" as const, icon: Wifi, color: "text-green-500" };
    case "OFFLINE":
      return { label: "Desconectado", variant: "destructive" as const, icon: WifiOff, color: "text-destructive" };
    case "FLAGGED":
      return { label: "Sinalizado", variant: "secondary" as const, icon: AlertCircle, color: "text-yellow-500" };
    case "RATE_LIMITED":
      return { label: "Limitado", variant: "secondary" as const, icon: AlertCircle, color: "text-yellow-500" };
    case "PENDING":
      return { label: "Pendente", variant: "outline" as const, icon: AlertCircle, color: "text-muted-foreground" };
    default:
      return { label: status || "Desconhecido", variant: "outline" as const, icon: AlertCircle, color: "text-muted-foreground" };
  }
}

export default function WhatsAppApiPage() {
  const { isAdmin } = useAuthContext();
  
  // Phone Registration State
  const [cc, setCc] = useState("55");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [pin, setPin] = useState("123456");
  const [registering, setRegistering] = useState(false);
  const [phoneNumberIdForCode, setPhoneNumberIdForCode] = useState("");
  const [codeMethod, setCodeMethod] = useState("SMS");
  const [requestingCode, setRequestingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Phone statuses
  const { phones, allPhones, syncPhones, isSyncing, isLoading: phonesLoading } = useWabaPhones();
  const availablePhones = isAdmin ? (allPhones.length > 0 ? allPhones : phones) : phones;
  const [phoneStatuses, setPhoneStatuses] = useState<Record<string, PhoneStatus>>({});
  const [checkingAllStatuses, setCheckingAllStatuses] = useState(false);
  
  // Set PIN for existing number
  const [setPinPhoneId, setSetPinPhoneId] = useState("");
  const [setPinValue, setSetPinValue] = useState("");
  const [settingPin, setSettingPin] = useState(false);

  // Business Profile State
  const [selectedPhoneId, setSelectedPhoneId] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileData, setProfileData] = useState({
    about: "",
    address: "",
    description: "",
    email: "",
    websites: "",
    vertical: "UNDEFINED",
    profile_picture_url: "",
  });

  const selectedPhone = availablePhones.find((p) => p.id === selectedPhoneId);
  const selectedPhoneStatus = selectedPhone ? phoneStatuses[selectedPhone.phone_number_id] : null;
  const isPhoneConnected = selectedPhoneStatus?.status === "CONNECTED";

  const getInvokeErrorMessage = async (invokeError: any, fallback: string) => {
    const response = invokeError?.context;
    const statusCode = response?.status;
    const statusSuffix = statusCode ? ` (HTTP ${statusCode})` : "";

    if (response && typeof response.clone === "function") {
      try {
        const rawText = await response.clone().text();
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText);
            const backendMessage =
              (typeof parsed?.error === "string" && parsed.error) ||
              (typeof parsed?.message === "string" && parsed.message) ||
              null;

            if (backendMessage) return `${backendMessage}${statusSuffix}`;
          } catch {
            return `${rawText}${statusSuffix}`;
          }
        }
      } catch {
        // fallback abaixo
      }
    }

    return `${invokeError?.message || fallback}${statusSuffix}`;
  };

  // Check status of a single phone
  const checkPhoneStatus = async (phoneNumberId: string) => {
    setPhoneStatuses((prev) => ({
      ...prev,
      [phoneNumberId]: { ...prev[phoneNumberId], id: phoneNumberId, loading: true },
    }));
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: { action: "check_status", phone_number_id: phoneNumberId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPhoneStatuses((prev) => ({
        ...prev,
        [phoneNumberId]: {
          id: phoneNumberId,
          status: data.data?.status,
          code_verification_status: data.data?.code_verification_status,
          quality_rating: data.data?.quality_rating,
          name_status: data.data?.name_status,
          loading: false,
        },
      }));
    } catch {
      setPhoneStatuses((prev) => ({
        ...prev,
        [phoneNumberId]: { ...prev[phoneNumberId], id: phoneNumberId, loading: false },
      }));
    }
  };

  // Check all phone statuses
  const checkAllStatuses = async () => {
    setCheckingAllStatuses(true);
    for (const phone of availablePhones) {
      await checkPhoneStatus(phone.phone_number_id);
    }
    setCheckingAllStatuses(false);
  };

  // Auto-check statuses when phones load
  useEffect(() => {
    if (availablePhones.length > 0 && Object.keys(phoneStatuses).length === 0) {
      checkAllStatuses();
    }
  }, [availablePhones.length]);

  const handleRegister = async () => {
    if (!phoneNumber || !verifiedName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const registerPin = pin || "123456";
    if (registerPin.length !== 6) {
      toast.error("O PIN deve ter exatamente 6 dígitos");
      return;
    }
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: { action: "register", cc, phone_number: phoneNumber, verified_name: verifiedName, pin: registerPin },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      const phoneNumberId = data.data?.id;
      if (phoneNumberId) {
        setPhoneNumberIdForCode(phoneNumberId);
        // Auto-set PIN to bring the number online immediately
        try {
          const { data: pinData, error: pinError } = await supabase.functions.invoke("manage-waba-phone", {
            body: { action: "set_pin", phone_number_id: phoneNumberId, pin: registerPin },
          });
          if (pinError) throw pinError;
          if (pinData?.error) throw new Error(pinData.error);
          toast.success("Número registrado e ativado com sucesso!", { description: "O PIN padrão foi configurado automaticamente." });
          syncPhones();
          // Reset form
          setPhoneNumber("");
          setVerifiedName("");
          return;
        } catch (pinErr: any) {
          const pinErrorMessage = await getInvokeErrorMessage(pinErr, "Falha ao configurar PIN automaticamente");
          toast.info("Número registrado! PIN automático falhou, configure manualmente.", { description: pinErrorMessage });
        }
      }
      
      toast.success("Número registrado!", { description: "Solicite o código de verificação ou defina o PIN." });
    } catch (err: any) {
      const errorMessage = await getInvokeErrorMessage(err, "Erro ao registrar número");
      toast.error("Erro ao registrar", { description: errorMessage });
    } finally {
      setRegistering(false);
    }
  };

  const handleRequestCode = async () => {
    if (!phoneNumberIdForCode) {
      toast.error("Informe o Phone Number ID");
      return;
    }
    setRequestingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: { action: "request_code", phone_number_id: phoneNumberIdForCode, code_method: codeMethod },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(`Código enviado via ${codeMethod}!`);
    } catch (err: any) {
      toast.error("Erro ao solicitar código", { description: err.message });
    } finally {
      setRequestingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!phoneNumberIdForCode || !verificationCode) {
      toast.error("Informe o código de verificação");
      return;
    }
    setVerifyingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: { action: "verify_code", phone_number_id: phoneNumberIdForCode, code: verificationCode },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Número verificado com sucesso!");
      syncPhones();
    } catch (err: any) {
      toast.error("Erro ao verificar código", { description: err.message });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSetPin = async () => {
    if (!setPinPhoneId) {
      toast.error("Selecione um número");
      return;
    }
    if (setPinValue.length !== 6) {
      toast.error("O PIN deve ter exatamente 6 dígitos");
      return;
    }
    setSettingPin(true);
    try {
      const selectedForPin = availablePhones.find((p) => p.id === setPinPhoneId);
      if (!selectedForPin) throw new Error("Número não encontrado");
      
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: { action: "set_pin", phone_number_id: selectedForPin.phone_number_id, pin: setPinValue },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("PIN definido com sucesso!", { description: "O número deve mudar de status em instantes." });
      setSetPinValue("");
      // Re-check status of this number
      checkPhoneStatus(selectedForPin.phone_number_id);
    } catch (err: any) {
      toast.error("Erro ao definir PIN", { description: err.message });
    } finally {
      setSettingPin(false);
    }
  };

  const handleLoadProfile = async () => {
    if (!selectedPhone) return;
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-profile", {
        body: { action: "get_profile", phone_number_id: selectedPhone.phone_number_id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const p = data.data || {};
      setProfileData({
        about: p.about || "",
        address: p.address || "",
        description: p.description || "",
        email: p.email || "",
        websites: (p.websites || []).join(", "),
        vertical: p.vertical || "UNDEFINED",
        profile_picture_url: p.profile_picture_url || "",
      });
      toast.success("Perfil carregado!");
    } catch (err: any) {
      toast.error("Erro ao carregar perfil", { description: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedPhone) return;
    setSavingProfile(true);
    try {
      const websites = profileData.websites.split(",").map((w) => w.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("manage-waba-profile", {
        body: {
          action: "update_profile",
          phone_number_id: selectedPhone.phone_number_id,
          about: profileData.about,
          address: profileData.address,
          description: profileData.description,
          email: profileData.email,
          websites: websites.length > 0 ? websites : undefined,
          vertical: profileData.vertical,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar perfil", { description: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUploadPhoto = async (file: File) => {
    if (!selectedPhone) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("manage-waba-profile", {
        body: {
          action: "upload_profile_photo",
          phone_number_id: selectedPhone.phone_number_id,
          image_base64: base64,
          image_type: file.type || "image/jpeg",
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Foto de perfil atualizada!");
      handleLoadProfile();
    } catch (err: any) {
      toast.error("Erro ao enviar foto", { description: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        <PageHeader
          title="Números"
          description="Registre números e configure perfis comerciais"
        />

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-3xl space-y-6">

            {/* Registered Numbers with Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wifi className="h-5 w-5" />
                      Números Cadastrados
                    </CardTitle>
                    <CardDescription>Status de conexão dos seus números</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => syncPhones()} disabled={isSyncing}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                        Sincronizar
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={checkAllStatuses} disabled={checkingAllStatuses}>
                      {checkingAllStatuses ? <LoadingSpinner size="sm" /> : "Verificar Status"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {phonesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner size="md" text="Carregando números..." />
                  </div>
                ) : availablePhones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum número cadastrado. Registre um número abaixo.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {availablePhones.map((phone) => {
                      const ps = phoneStatuses[phone.phone_number_id];
                      const statusInfo = getStatusInfo(ps?.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <div key={phone.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <StatusIcon className={`h-5 w-5 flex-shrink-0 ${statusInfo.color}`} />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{phone.display_phone_number}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {phone.verified_name || "Sem nome verificado"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ps?.quality_rating && (
                              <Badge variant="outline" className="text-xs">
                                {ps.quality_rating}
                              </Badge>
                            )}
                            {ps?.loading ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Register Phone Number */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Registrar Novo Número
                </CardTitle>
                <CardDescription>
                  Adicione um novo número ao WhatsApp Business Account via API da Meta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAdmin ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Código do País</Label>
                        <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="55" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Número de Telefone</Label>
                        <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="11999998888" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome Verificado (exibido no WhatsApp)</Label>
                      <Input value={verifiedName} onChange={(e) => setVerifiedName(e.target.value)} placeholder="Nome da Empresa" />
                    </div>
                    <div className="space-y-2">
                      <Label>PIN de 2 Fatores (6 dígitos)</Label>
                      <Input
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {availablePhones.length >= 3 ? (
                      <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                        <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        <span>Você atingiu o limite de 3 números. Exclua um número existente para registrar outro.</span>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label>Número de Telefone (com DDD)</Label>
                          <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="11999998888" />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome de Exibição</Label>
                          <Input value={verifiedName} onChange={(e) => setVerifiedName(e.target.value)} placeholder="Nome que aparecerá no WhatsApp" />
                        </div>
                      </>
                    )}
                  </>
                )}
                <Button onClick={handleRegister} disabled={registering || (!isAdmin && availablePhones.length >= 3)} className="w-full">
                  {registering ? <LoadingSpinner size="sm" /> : <Send className="mr-2 h-4 w-4" />}
                  {registering ? "Registrando..." : "Registrar Número"}
                </Button>

                {/* Verification */}
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm">Verificação do Número</h4>
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input
                      value={phoneNumberIdForCode}
                      onChange={(e) => setPhoneNumberIdForCode(e.target.value)}
                      placeholder="ID retornado após registro"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={codeMethod} onValueChange={setCodeMethod}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SMS">SMS</SelectItem>
                        <SelectItem value="VOICE">Ligação</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleRequestCode} disabled={requestingCode} variant="outline" className="flex-1">
                      {requestingCode ? <LoadingSpinner size="sm" /> : "Solicitar Código"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Código recebido"
                      className="flex-1"
                    />
                    <Button onClick={handleVerifyCode} disabled={verifyingCode}>
                      {verifyingCode ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Verificar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Set PIN for Existing Number */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Definir PIN para Número Existente
                  </CardTitle>
                  <CardDescription>
                    Defina o PIN de verificação em duas etapas para um número que já está cadastrado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione o Número</Label>
                    <Select value={setPinPhoneId} onValueChange={setSetPinPhoneId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um número..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePhones.map((p) => {
                          const ps = phoneStatuses[p.phone_number_id];
                          const statusInfo = getStatusInfo(ps?.status);
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                <span className={`inline-block h-2 w-2 rounded-full ${ps?.status === "CONNECTED" ? "bg-green-500" : ps?.status === "PENDING" ? "bg-yellow-500" : "bg-destructive"}`} />
                                {p.display_phone_number} {p.verified_name ? `(${p.verified_name})` : ""}
                                {ps?.status ? ` — ${statusInfo.label}` : ""}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>PIN de 2 Fatores (6 dígitos)</Label>
                    <Input
                      value={setPinValue}
                      onChange={(e) => setSetPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                  <Button onClick={handleSetPin} disabled={settingPin} className="w-full">
                    {settingPin ? <LoadingSpinner size="sm" /> : <Lock className="mr-2 h-4 w-4" />}
                    {settingPin ? "Definindo PIN..." : "Definir PIN"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Business Profile - available to all users */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle className="h-5 w-5" />
                    Perfil Comercial do WhatsApp
                  </CardTitle>
                  <CardDescription>
                    {isPhoneConnected
                      ? "Configure o perfil comercial exibido no WhatsApp"
                      : "Selecione um número conectado para editar o perfil comercial"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Selecione o Número</Label>
                      <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um número..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePhones.map((p) => {
                            const ps = phoneStatuses[p.phone_number_id];
                            const connected = ps?.status === "CONNECTED";
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="flex items-center gap-2">
                                  <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-destructive"}`} />
                                  {p.display_phone_number} {p.verified_name ? `(${p.verified_name})` : ""}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleLoadProfile}
                      disabled={!selectedPhoneId || profileLoading || !isPhoneConnected}
                      variant="outline"
                    >
                      {profileLoading ? <LoadingSpinner size="sm" /> : "Carregar Perfil"}
                    </Button>
                  </div>

                  {selectedPhoneId && !isPhoneConnected && (
                    <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                      <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      <span>
                        Este número não está conectado. Aguarde a conexão para editar o perfil comercial.
                      </span>
                    </div>
                  )}

                  {isPhoneConnected && (
                    <>
                      <div className="flex items-center gap-4">
                        {profileData.profile_picture_url ? (
                          <img
                            src={profileData.profile_picture_url}
                            alt="Foto do perfil"
                            className="h-16 w-16 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-full border flex items-center justify-center bg-muted">
                            <Image className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {profileData.profile_picture_url ? "Foto atual do perfil" : "Sem foto de perfil"}
                          </p>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/jpeg,image/png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadPhoto(file);
                                e.target.value = "";
                              }}
                              disabled={uploadingPhoto}
                            />
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                              {uploadingPhoto ? (
                                <><LoadingSpinner size="sm" /> Enviando...</>
                              ) : (
                                <><Upload className="h-4 w-4" /> Alterar foto</>
                              )}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Sobre (até 139 caracteres)</Label>
                        <Input
                          value={profileData.about}
                          onChange={(e) => setProfileData({ ...profileData, about: e.target.value.slice(0, 139) })}
                          placeholder="Breve descrição"
                          maxLength={139}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Descrição (até 512 caracteres)</Label>
                        <Textarea
                          value={profileData.description}
                          onChange={(e) => setProfileData({ ...profileData, description: e.target.value.slice(0, 512) })}
                          placeholder="Descrição detalhada"
                          maxLength={512}
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Endereço</Label>
                          <Input
                            value={profileData.address}
                            onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                            placeholder="Rua, nº - Cidade/UF"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={profileData.email}
                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                            placeholder="contato@empresa.com"
                            type="email"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Websites (separados por vírgula)</Label>
                        <Input
                          value={profileData.websites}
                          onChange={(e) => setProfileData({ ...profileData, websites: e.target.value })}
                          placeholder="https://empresa.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Categoria do Negócio</Label>
                        <Select
                          value={profileData.vertical}
                          onValueChange={(v) => setProfileData({ ...profileData, vertical: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VERTICALS.map((v) => (
                              <SelectItem key={v.value} value={v.value}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
                        {savingProfile ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Salvar Perfil Comercial
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
