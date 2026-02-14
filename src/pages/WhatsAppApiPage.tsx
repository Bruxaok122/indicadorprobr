import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, UserCircle, Send, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWabaPhones } from "@/hooks/useWabaPhones";

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

export default function WhatsAppApiPage() {
  // Phone Registration State
  const [cc, setCc] = useState("55");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [pin, setPin] = useState("");
  const [registering, setRegistering] = useState(false);
  const [phoneNumberIdForCode, setPhoneNumberIdForCode] = useState("");
  const [codeMethod, setCodeMethod] = useState("SMS");
  const [requestingCode, setRequestingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  // Business Profile State
  const { allPhones, syncPhones, isSyncing } = useWabaPhones();
  const [selectedPhoneId, setSelectedPhoneId] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    about: "",
    address: "",
    description: "",
    email: "",
    websites: "",
    vertical: "UNDEFINED",
  });

  const handleRegister = async () => {
    if (!phoneNumber || !verifiedName || !pin) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (pin.length !== 6) {
      toast.error("O PIN deve ter exatamente 6 dígitos");
      return;
    }
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-phone", {
        body: { action: "register", cc, phone_number: phoneNumber, verified_name: verifiedName, pin },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success("Número registrado com sucesso!", { description: "Agora solicite o código de verificação." });
      if (data.data?.id) {
        setPhoneNumberIdForCode(data.data.id);
      }
    } catch (err: any) {
      toast.error("Erro ao registrar número", { description: err.message });
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

  const handleLoadProfile = async () => {
    if (!selectedPhoneId) {
      toast.error("Selecione um número");
      return;
    }
    const phone = allPhones.find((p) => p.id === selectedPhoneId);
    if (!phone) return;

    setProfileLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-waba-profile", {
        body: { action: "get_profile", phone_number_id: phone.phone_number_id },
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
      });
      toast.success("Perfil carregado!");
    } catch (err: any) {
      toast.error("Erro ao carregar perfil", { description: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedPhoneId) return;
    const phone = allPhones.find((p) => p.id === selectedPhoneId);
    if (!phone) return;

    setSavingProfile(true);
    try {
      const websites = profileData.websites
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);

      const { data, error } = await supabase.functions.invoke("manage-waba-profile", {
        body: {
          action: "update_profile",
          phone_number_id: phone.phone_number_id,
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

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Gerenciar API WhatsApp"
          description="Registre números e configure perfis comerciais via API da Meta"
        />

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Section 1: Register Phone Number */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Registrar Número de Telefone
                </CardTitle>
                <CardDescription>
                  Adicione um novo número ao WhatsApp Business Account (WABA) via API da Meta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Código do País</Label>
                    <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="55" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Número de Telefone</Label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="11999998888"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome Verificado (exibido no WhatsApp)</Label>
                  <Input
                    value={verifiedName}
                    onChange={(e) => setVerifiedName(e.target.value)}
                    placeholder="Nome da Empresa"
                  />
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
                <Button onClick={handleRegister} disabled={registering} className="w-full">
                  {registering ? <LoadingSpinner size="sm" /> : <Send className="mr-2 h-4 w-4" />}
                  {registering ? "Registrando..." : "Registrar Número"}
                </Button>

                {/* Verification Section */}
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium text-sm">Verificação do Número</h4>
                  <div className="space-y-2">
                    <Label>Phone Number ID (retornado após registro)</Label>
                    <Input
                      value={phoneNumberIdForCode}
                      onChange={(e) => setPhoneNumberIdForCode(e.target.value)}
                      placeholder="ID retornado pela Meta"
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

            {/* Section 2: Business Profile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  Perfil Comercial do WhatsApp
                </CardTitle>
                <CardDescription>
                  Configure o perfil comercial exibido para seus clientes no WhatsApp
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
                        {allPhones.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_phone_number} {p.verified_name ? `(${p.verified_name})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => syncPhones()} disabled={isSyncing} title="Sincronizar números">
                    <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  </Button>
                  <Button onClick={handleLoadProfile} disabled={!selectedPhoneId || profileLoading} variant="outline">
                    {profileLoading ? <LoadingSpinner size="sm" /> : "Carregar Perfil"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Sobre (até 139 caracteres)</Label>
                  <Input
                    value={profileData.about}
                    onChange={(e) => setProfileData({ ...profileData, about: e.target.value.slice(0, 139) })}
                    placeholder="Breve descrição da empresa"
                    maxLength={139}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição (até 512 caracteres)</Label>
                  <Textarea
                    value={profileData.description}
                    onChange={(e) => setProfileData({ ...profileData, description: e.target.value.slice(0, 512) })}
                    placeholder="Descrição detalhada da empresa"
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
                    placeholder="https://empresa.com, https://loja.empresa.com"
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

                <Button onClick={handleSaveProfile} disabled={!selectedPhoneId || savingProfile} className="w-full">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
