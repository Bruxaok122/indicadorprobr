import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
import { Phone, UserCircle, Send, CheckCircle, RefreshCw, Wifi, WifiOff, AlertCircle, Upload, Image, Lock, Trash2, ChevronRight, ChevronLeft, ShieldCheck, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const queryClient = useQueryClient();

  
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
  const [deletingPhoneId, setDeletingPhoneId] = useState<string | null>(null);
  
  // Set PIN for existing number
  const [setPinPhoneId, setSetPinPhoneId] = useState("");
  const [setPinValue, setSetPinValue] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [refreshNamePhoneId, setRefreshNamePhoneId] = useState("");
  const [refreshNamePin, setRefreshNamePin] = useState("");
  const [refreshingName, setRefreshingName] = useState(false);
  // Set PIN by raw phone_number_id (any WABA/account)
  const [pinByIdValue, setPinByIdValue] = useState("");
  const [pinByIdPin, setPinByIdPin] = useState("123456");
  const [pinByIdToken, setPinByIdToken] = useState("");
  const [settingPinById, setSettingPinById] = useState(false);
  // Adicionar número externo (qualquer BM) pelo Phone Number ID
  const [extPhoneId, setExtPhoneId] = useState("");
  const [extToken, setExtToken] = useState("");
  const [extPin, setExtPin] = useState("123456");
  const [extLawyer, setExtLawyer] = useState("");
  const [addingExt, setAddingExt] = useState(false);


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
  const selectedRefreshNamePhone = availablePhones.find((p) => p.id === refreshNamePhoneId);

  // Wizard (operator only)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const wizardPhone = availablePhones.find((p) => p.phone_number_id === phoneNumberIdForCode);
  const wizardStatus = phoneNumberIdForCode ? phoneStatuses[phoneNumberIdForCode] : undefined;
  const wizardConnected = wizardStatus?.status === "CONNECTED";

  // Real-time status polling on step 3
  useEffect(() => {
    if (isAdmin) return;
    if (wizardStep !== 3 || !phoneNumberIdForCode) return;
    checkPhoneStatus(phoneNumberIdForCode);
    const iv = setInterval(() => {
      checkPhoneStatus(phoneNumberIdForCode);
    }, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, phoneNumberIdForCode, isAdmin]);

  // When entering step 4, auto-select the phone we just registered (if available)
  useEffect(() => {
    if (isAdmin) return;
    if (wizardStep === 4 && wizardPhone && !selectedPhoneId) {
      setSelectedPhoneId(wizardPhone.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardStep, wizardPhone?.id, isAdmin]);

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
    if (!isAdmin) {
      const trimmed = verifiedName.trim();
      const hasValidSuffix = /(^|\s)Advogados(\s+Associados)?$/i.test(trimmed);
      if (!hasValidSuffix) {
        toast.error("Nome inválido", {
          description: 'O nome de exibição deve terminar com "Advogados" ou "Advogados Associados".',
        });
        return;
      }
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

  const handleRefreshDisplayNameCertificate = async () => {
    if (!selectedRefreshNamePhone) {
      toast.error("Selecione o número com problema");
      return;
    }
    if (refreshNamePin.length !== 6) {
      toast.error("Informe o PIN atual de 6 dígitos");
      return;
    }

    setRefreshingName(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: {
          action: "refresh_display_name_certificate",
          db_id: selectedRefreshNamePhone.id,
          phone_number_id: selectedRefreshNamePhone.phone_number_id,
          pin: refreshNamePin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const syncedName = data?.phone?.verified_name || data?.data?.verified_name;
      toast.success("Nome de exibição corrigido!", {
        description: syncedName
          ? `Nome sincronizado: ${syncedName}`
          : "Certificado revalidado. Pode levar algumas horas para contatos antigos verem a alteração.",
      });
      setRefreshNamePin("");
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
      checkPhoneStatus(selectedRefreshNamePhone.phone_number_id);
    } catch (err: any) {
      const msg = await getInvokeErrorMessage(err, "Erro ao corrigir nome de exibição");
      toast.error("Erro ao corrigir nome", { description: msg });
    } finally {
      setRefreshingName(false);
    }
  };

  const handleSetPinById = async () => {
    const pnid = pinByIdValue.trim();
    if (!pnid) {
      toast.error("Informe o Phone Number ID");
      return;
    }
    if (pinByIdPin.length !== 6) {
      toast.error("O PIN deve ter exatamente 6 dígitos");
      return;
    }
    setSettingPinById(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: {
          action: "set_pin_by_id",
          phone_number_id: pnid,
          pin: pinByIdPin,
          access_token: pinByIdToken.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("PIN definido com sucesso!", {
        description: data?.used_token ? `Token utilizado: ${data.used_token}` : undefined,
      });
      setPinByIdValue("");
    } catch (err: any) {
      const msg = await getInvokeErrorMessage(err, "Erro ao definir PIN");
      toast.error("Erro ao definir PIN", { description: msg });
    } finally {
      setSettingPinById(false);
    }
  };

  const handleAddExternalPhone = async () => {
    const pnid = extPhoneId.trim();
    if (!pnid) {
      toast.error("Informe o Phone Number ID");
      return;
    }
    if (extPin && extPin.length !== 6) {
      toast.error("O PIN deve ter exatamente 6 dígitos");
      return;
    }
    setAddingExt(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: {
          action: "add_external_phone",
          phone_number_id: pnid,
          access_token: extToken.trim() || undefined,
          pin: extPin || undefined,
          lawyer_name: extLawyer.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const pinInfo = data?.pin;
      toast.success(`Número ${data?.phone?.display_phone_number || pnid} adicionado!`, {
        description: pinInfo
          ? pinInfo.success
            ? "PIN de 2 fatores ativado."
            : `Número salvo, mas o PIN falhou: ${pinInfo.error}`
          : undefined,
      });
      setExtPhoneId("");
      setExtToken("");
      setExtLawyer("");
      queryClient.invalidateQueries({ queryKey: ["waba-phones"] });
      queryClient.invalidateQueries({ queryKey: ["waba-phones-all"] });
    } catch (err: any) {
      const msg = await getInvokeErrorMessage(err, "Erro ao adicionar número");
      toast.error("Erro ao adicionar número", { description: msg });
    } finally {
      setAddingExt(false);
    }
  };



  const handleDeletePhone = async (phone: typeof availablePhones[0]) => {

    setDeletingPhoneId(phone.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: {
          action: "delete_phone",
          phone_number_id: phone.phone_number_id,
          db_id: phone.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Número excluído com sucesso!");
      syncPhones();
    } catch (err: any) {
      const errorMessage = await getInvokeErrorMessage(err, "Erro ao excluir número");
      toast.error("Erro ao excluir número", { description: errorMessage });
    } finally {
      setDeletingPhoneId(null);
    }
  };

  const handleLoadProfile = async () => {
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  disabled={deletingPhoneId === phone.id}
                                >
                                  {deletingPhoneId === phone.id ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir número</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir permanentemente o número <strong>{phone.display_phone_number}</strong>? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePhone(phone)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {isAdmin && (<>
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

            {/* Refresh display name certificate */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Corrigir Nome de Exibição
                  </CardTitle>
                  <CardDescription>
                    Revalida o número com o PIN atual e sincroniza o nome aprovado na Meta.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione o Número</Label>
                    <Select value={refreshNamePhoneId} onValueChange={setRefreshNamePhoneId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o número com problema..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePhones.map((p) => {
                          const ps = phoneStatuses[p.phone_number_id];
                          const statusInfo = getStatusInfo(ps?.status);
                          return (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                <span className={cn("inline-block h-2 w-2 rounded-full", ps?.status === "CONNECTED" ? "bg-success" : "bg-muted-foreground")} />
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
                    <Label>PIN atual de 2 Fatores</Label>
                    <Input
                      value={refreshNamePin}
                      onChange={(e) => setRefreshNamePin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      className="font-mono"
                    />
                  </div>
                  {selectedRefreshNamePhone && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                      Atual: <span className="font-medium text-foreground">{selectedRefreshNamePhone.verified_name || "sem nome sincronizado"}</span>
                    </div>
                  )}
                  <Button
                    onClick={handleRefreshDisplayNameCertificate}
                    disabled={refreshingName || !selectedRefreshNamePhone || refreshNamePin.length !== 6}
                    className="w-full"
                  >
                    {refreshingName ? <LoadingSpinner size="sm" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {refreshingName ? "Corrigindo..." : "Corrigir nome aprovado"}
                  </Button>
                </CardContent>
              </Card>

            {/* Set PIN by raw Phone Number ID (any WABA/account) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Definir PIN por Phone Number ID
                  </CardTitle>
                  <CardDescription>
                    Defina o PIN diretamente informando o ID do número (ex: 1010147042192402). Funciona para qualquer WABA/conta, desde que algum access token configurado tenha permissão — ou informe um token específico abaixo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input
                      value={pinByIdValue}
                      onChange={(e) => setPinByIdValue(e.target.value.replace(/\s/g, ""))}
                      placeholder="1010147042192402"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PIN de 2 Fatores (6 dígitos)</Label>
                    <Input
                      value={pinByIdPin}
                      onChange={(e) => setPinByIdPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token (opcional)</Label>
                    <Input
                      type="password"
                      value={pinByIdToken}
                      onChange={(e) => setPinByIdToken(e.target.value)}
                      placeholder="Deixe vazio para tentar com todos os tokens configurados"
                    />
                  </div>
                  <Button onClick={handleSetPinById} disabled={settingPinById} className="w-full">
                    {settingPinById ? <LoadingSpinner size="sm" /> : <Lock className="mr-2 h-4 w-4" />}
                    {settingPinById ? "Definindo PIN..." : "Definir PIN"}
                  </Button>
                </CardContent>
              </Card>

            {/* Adicionar número de qualquer BM pelo Phone Number ID */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Adicionar Número de Outra BM (por ID)
                  </CardTitle>
                  <CardDescription>
                    Informe o Phone Number ID de qualquer BM. O número é salvo no sistema e o PIN de 2 fatores é ativado. Se você não tiver acesso à BM, cole um access token dela abaixo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input
                      value={extPhoneId}
                      onChange={(e) => setExtPhoneId(e.target.value.replace(/\s/g, ""))}
                      placeholder="1010147042192402"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token da BM (opcional)</Label>
                    <Input
                      type="password"
                      value={extToken}
                      onChange={(e) => setExtToken(e.target.value)}
                      placeholder="Deixe vazio para tentar com os tokens já configurados"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PIN de 2 Fatores (6 dígitos)</Label>
                      <Input
                        value={extPin}
                        onChange={(e) => setExtPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Advogado (opcional)</Label>
                      <Input
                        value={extLawyer}
                        onChange={(e) => setExtLawyer(e.target.value)}
                        placeholder="Nome do advogado"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddExternalPhone} disabled={addingExt} className="w-full">
                    {addingExt ? <LoadingSpinner size="sm" /> : <Phone className="mr-2 h-4 w-4" />}
                    {addingExt ? "Adicionando..." : "Adicionar número e ativar PIN"}
                  </Button>
                </CardContent>
              </Card>



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
            </>)}

            {!isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Assistente de Novo Número
                  </CardTitle>
                  <CardDescription>
                    Siga as 4 etapas para cadastrar seu número no WhatsApp Business.
                  </CardDescription>

                  {/* Steps indicator */}
                  <div className="flex items-center gap-1 sm:gap-2 pt-3">
                    {[
                      { n: 1, label: "Registrar", icon: Phone },
                      { n: 2, label: "Verificar SMS", icon: MessageSquare },
                      { n: 3, label: "Definir PIN", icon: Lock },
                      { n: 4, label: "Perfil", icon: UserCircle },
                    ].map((s, idx) => {
                      const Icon = s.icon;
                      const active = wizardStep === s.n;
                      const done = wizardStep > s.n;
                      return (
                        <div key={s.n} className="flex items-center gap-1 sm:gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() => setWizardStep(s.n as 1 | 2 | 3 | 4)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors flex-1 justify-center cursor-pointer hover:opacity-90",
                              active && "bg-primary text-primary-foreground",
                              done && "bg-primary/20 text-primary",
                              !active && !done && "bg-muted text-muted-foreground hover:bg-muted/70",
                            )}
                          >
                            {done ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">{s.n}. {s.label}</span>
                            <span className="sm:hidden">{s.n}</span>
                          </button>
                          {idx < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* STEP 1: Register */}
                  {wizardStep === 1 && (
                    <div className="space-y-4">
                      {availablePhones.length >= 3 ? (
                        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                          <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                          <span>Você atingiu o limite de 3 números. Exclua um número existente para registrar outro.</span>
                        </div>
                      ) : (
                        <>
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                            Informe o número de telefone (com DDD) e o nome que aparecerá no WhatsApp. Após registrar, o próximo passo será a verificação por SMS.
                          </div>
                          <div className="space-y-2">
                            <Label>Número de Telefone (com DDD)</Label>
                            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="11999998888" />
                          </div>
                          <div className="space-y-2">
                            <Label>Nome de Exibição</Label>
                            <Input value={verifiedName} onChange={(e) => setVerifiedName(e.target.value)} placeholder="Nome que aparecerá no WhatsApp" />
                          </div>
                          <Button
                            onClick={async () => {
                              const prevId = phoneNumberIdForCode;
                              await handleRegister();
                              // Advance if a new phoneNumberIdForCode was set
                              setTimeout(() => {
                                setPhoneNumberIdForCode((curr) => {
                                  if (curr && curr !== prevId) {
                                    setWizardStep(2);
                                  }
                                  return curr;
                                });
                              }, 100);
                            }}
                            disabled={registering || availablePhones.length >= 3 || !phoneNumber || !verifiedName}
                            className="w-full"
                          >
                            {registering ? <LoadingSpinner size="sm" /> : <Send className="mr-2 h-4 w-4" />}
                            {registering ? "Registrando..." : "Registrar e Avançar"}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {/* STEP 2: Verify SMS */}
                  {wizardStep === 2 && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                        Solicite o código de verificação por SMS ou ligação e insira o código recebido no número cadastrado.
                      </div>
                      <div className="space-y-2">
                        <Label>ID do Número (preenchido automaticamente)</Label>
                        <Input value={phoneNumberIdForCode} readOnly className="bg-muted font-mono text-xs" />
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
                        <Button onClick={handleRequestCode} disabled={requestingCode || !phoneNumberIdForCode} variant="outline" className="flex-1">
                          {requestingCode ? <LoadingSpinner size="sm" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                          {requestingCode ? "Enviando..." : "Solicitar Código"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label>Código Recebido</Label>
                        <Input
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                          placeholder="Ex: 123456"
                          className="text-center text-lg tracking-widest font-mono"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setWizardStep(1)} className="flex-1">
                          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                        </Button>
                        <Button
                          onClick={async () => {
                            await handleVerifyCode();
                            setTimeout(() => setWizardStep(3), 300);
                          }}
                          disabled={verifyingCode || !verificationCode}
                          className="flex-1"
                        >
                          {verifyingCode ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                          {verifyingCode ? "Verificando..." : "Verificar e Avançar"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Set PIN + realtime status */}
                  {wizardStep === 3 && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                        Defina um PIN de 6 dígitos. Após confirmar, aguarde o status ficar <strong>Conectado</strong> — atualizamos automaticamente a cada 5 segundos.
                      </div>

                      {/* Realtime status */}
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {(() => {
                            const info = getStatusInfo(wizardStatus?.status);
                            const Icon = info.icon;
                            return (
                              <>
                                <Icon className={cn("h-5 w-5 flex-shrink-0", info.color)} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">Status atual</p>
                                  {wizardStatus?.loading ? (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <LoadingSpinner size="sm" /> verificando...
                                    </div>
                                  ) : (
                                    <Badge variant={info.variant} className="text-xs mt-0.5">{info.label}</Badge>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => phoneNumberIdForCode && checkPhoneStatus(phoneNumberIdForCode)}
                          disabled={!phoneNumberIdForCode || wizardStatus?.loading}
                        >
                          <RefreshCw className={cn("h-4 w-4", wizardStatus?.loading && "animate-spin")} />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label>PIN de 6 dígitos</Label>
                        <Input
                          value={setPinValue || pin}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setSetPinValue(v);
                            setPin(v);
                          }}
                          placeholder="123456"
                          maxLength={6}
                          className="text-center text-lg tracking-widest font-mono"
                        />
                        <p className="text-xs text-muted-foreground">Guarde este PIN — ele é usado em futuras verificações.</p>
                      </div>

                      <Button
                        onClick={async () => {
                          const pinVal = (setPinValue || pin || "123456");
                          if (pinVal.length !== 6) {
                            toast.error("O PIN deve ter 6 dígitos");
                            return;
                          }
                          setSettingPin(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
                              body: { action: "set_pin", phone_number_id: phoneNumberIdForCode, pin: pinVal },
                            });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            toast.success("PIN definido! Aguardando conexão...");
                            checkPhoneStatus(phoneNumberIdForCode);
                          } catch (err: any) {
                            const msg = await getInvokeErrorMessage(err, "Erro ao definir PIN");
                            toast.error("Erro ao definir PIN", { description: msg });
                          } finally {
                            setSettingPin(false);
                          }
                        }}
                        disabled={settingPin || !phoneNumberIdForCode}
                        className="w-full"
                      >
                        {settingPin ? <LoadingSpinner size="sm" /> : <Lock className="mr-2 h-4 w-4" />}
                        {settingPin ? "Definindo..." : "Definir PIN"}
                      </Button>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setWizardStep(2)} className="flex-1">
                          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                        </Button>
                        <Button
                          onClick={() => setWizardStep(4)}
                          disabled={!wizardConnected}
                          className="flex-1"
                        >
                          Avançar <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                      {!wizardConnected && (
                        <p className="text-xs text-muted-foreground text-center">
                          O botão "Avançar" será liberado quando o número estiver Conectado.
                        </p>
                      )}
                    </div>
                  )}

                  {/* STEP 4: Business Profile */}
                  {wizardStep === 4 && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                        Monte seu perfil comercial: foto, nome, descrição e categoria. Isso aumenta a confiança nos disparos.
                      </div>

                      {!selectedPhone ? (
                        <div className="space-y-2">
                          <Label>Selecione o Número</Label>
                          <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um número..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePhones.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.display_phone_number} {p.verified_name ? `(${p.verified_name})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div className="text-sm">
                            <p className="font-medium">{selectedPhone.display_phone_number}</p>
                            <p className="text-xs text-muted-foreground">{selectedPhone.verified_name || "Sem nome"}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={handleLoadProfile} disabled={profileLoading || !isPhoneConnected}>
                            {profileLoading ? <LoadingSpinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}

                      {selectedPhoneId && !isPhoneConnected && (
                        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                          <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                          <span>Este número ainda não está conectado. Volte à etapa 3 para verificar.</span>
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
                                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
                            {savingProfile ? <LoadingSpinner size="sm" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            {savingProfile ? "Salvando..." : "Salvar Perfil Comercial"}
                          </Button>
                        </>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setWizardStep(3)} className="flex-1">
                          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                        </Button>
                        <Button
                          onClick={() => {
                            // Reset wizard for a new number
                            setWizardStep(1);
                            setPhoneNumber("");
                            setVerifiedName("");
                            setPhoneNumberIdForCode("");
                            setVerificationCode("");
                            setSetPinValue("");
                            toast.success("Assistente reiniciado!");
                          }}
                          variant="secondary"
                          className="flex-1"
                        >
                          Concluir <CheckCircle className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
