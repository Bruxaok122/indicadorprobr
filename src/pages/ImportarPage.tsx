import { useState } from "react";
import { useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContacts } from "@/hooks/useContacts";
import { parseJuridicalList, validateJuridicalList } from "@/lib/parseJuridicalList";
import { ParsedContact } from "@/types/juriszap";
import { AlertBanner } from "@/components/ui/alert-banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
  Phone,
  Scale,
  Plus,
  UserPlus,
  File,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ImportarPage() {
  const { importContacts, isImporting, addContact, isAddingContact } = useContacts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import state
  const [rawText, setRawText] = useState("");
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Single contact state
  const [singleName, setSingleName] = useState("");
  const [singlePhone, setSinglePhone] = useState("");
  const [singleLawyer, setSingleLawyer] = useState("");
  const [singleProcess, setSingleProcess] = useState("");

  const handleParse = () => {
    const { contacts, errors } = parseJuridicalList(rawText);
    setParsedContacts(contacts);
    setParseErrors(errors);
    if (contacts.length > 0) {
      setShowPreview(true);
    }
  };

  const handleImport = () => {
    importContacts(parsedContacts, {
      onSuccess: () => {
        setRawText("");
        setParsedContacts([]);
        setParseErrors([]);
        setShowPreview(false);
      },
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".txt")) {
      toast.error("Apenas arquivos .txt são permitidos");
      return;
    }

    setIsLoadingFile(true);
    try {
      const text = await file.text();
      setRawText(text);
      
      // Auto-parse after loading
      const { contacts, errors } = parseJuridicalList(text);
      setParsedContacts(contacts);
      setParseErrors(errors);
      
      if (contacts.length > 0) {
        setShowPreview(true);
        toast.success(`Arquivo carregado: ${contacts.length} contato(s) encontrado(s)`);
      } else {
        toast.warning("Nenhum contato encontrado no arquivo");
      }
    } catch (err) {
      toast.error("Erro ao ler o arquivo");
      console.error(err);
    } finally {
      setIsLoadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddSingle = () => {
    if (!singleName.trim() || !singlePhone.trim()) return;

    // Normalize phone
    let phone = singlePhone.replace(/\D/g, "");
    if (phone.length === 11) {
      phone = "55" + phone;
    } else if (phone.length === 10) {
      phone = "55" + phone.slice(0, 2) + "9" + phone.slice(2);
    } else if (!phone.startsWith("55")) {
      phone = "55" + phone;
    }

    addContact(
      {
        name: singleName.trim(),
        phone,
        lawyer_name: singleLawyer.trim() || undefined,
        process_number: singleProcess.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSingleName("");
          setSinglePhone("");
          setSingleLawyer("");
          setSingleProcess("");
        },
      }
    );
  };

  const validation = validateJuridicalList(rawText);

  const exampleText = `================================================================================

ADVOGADO: Lourival Casemiro Rodrigues

PROCESSO: 1000346-90.2023.8.26.0627

Requerente (Polo Ativo):

👤 Nome: Rosimari Barbosa Ferreira

💳 Doc.: CPF: 388.900.088-65 | RENDA: R$ 2.825,00 | IDADE: 34

📞 Telefones: (18) 99650-6971, (18) 99755-5438

⚖️ Advogado 1: Lourival Casemiro Rodrigues

📞 Telefones: (não disponíveis nesta etapa)

Requerido (Polo Passivo):

🏢 Nome: PREFEITURA MUNICIPAL

================================================================================`;

  return (
    <AppLayout>
      <div className="flex h-screen flex-col overflow-hidden">
        <PageHeader
          title="Importar Contatos"
          description="Importe sua lista jurídica ou adicione contatos individualmente"
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <Tabs defaultValue="lista" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="lista" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Importar Lista
                </TabsTrigger>
                <TabsTrigger value="individual" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Adicionar Individual
                </TabsTrigger>
              </TabsList>

              {/* Tab: Import List */}
              <TabsContent value="lista" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-accent" />
                      Cole sua Lista Jurídica
                    </CardTitle>
                    <CardDescription>
                      Cole o texto da lista no formato padrão. O sistema irá extrair
                      automaticamente os dados de cada cliente e seus telefones.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* File Upload */}
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".txt"
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoadingFile}
                        className="w-full"
                      >
                        {isLoadingFile ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Carregando...
                          </>
                        ) : (
                          <>
                            <File className="mr-2 h-4 w-4" />
                            Carregar Arquivo .txt
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          ou cole o texto
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rawText">Lista de Contatos</Label>
                      <Textarea
                        id="rawText"
                        placeholder="Cole aqui a lista de contatos no formato com separadores ================"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        className="min-h-[300px] font-mono text-sm"
                      />
                    </div>

                    {/* Validation Status */}
                    {rawText.length > 0 && (
                      <div
                        className={`flex items-center gap-2 rounded-lg p-3 ${
                          validation.isValid
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {validation.isValid ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        <span className="text-sm">{validation.message}</span>
                      </div>
                    )}

                    <Button
                      onClick={handleParse}
                      disabled={!validation.isValid}
                      className="w-full"
                      size="lg"
                      
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Processar Lista
                    </Button>
                  </CardContent>
                </Card>

                {/* Format Example */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Formato Esperado</CardTitle>
                    <CardDescription>
                      O sistema aceita o formato com emojis e extrai: Nome do cliente (👤), 
                      Telefones (📞), Advogado (⚖️ ou ADVOGADO:), e Processo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap">
                      {exampleText}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setRawText(exampleText)}
                    >
                      Usar Exemplo
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Add Single Contact */}
              <TabsContent value="individual" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-accent" />
                      Adicionar Contato Individual
                    </CardTitle>
                    <CardDescription>
                      Preencha os dados do cliente para adicionar manualmente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="singleName">
                          Nome do Cliente <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="singleName"
                            placeholder="Ex: Maria Santos"
                            value={singleName}
                            onChange={(e) => setSingleName(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="singlePhone">
                          Telefone <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="singlePhone"
                            placeholder="Ex: (11) 99999-8888"
                            value={singlePhone}
                            onChange={(e) => setSinglePhone(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="singleLawyer">Parte Contrária</Label>
                        <div className="relative">
                          <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="singleLawyer"
                            placeholder="Ex: Dr. João Silva"
                            value={singleLawyer}
                            onChange={(e) => setSingleLawyer(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="singleProcess">Número do Processo</Label>
                        <Input
                          id="singleProcess"
                          placeholder="Ex: 1234567-89.2024.8.26.0100"
                          value={singleProcess}
                          onChange={(e) => setSingleProcess(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleAddSingle}
                      disabled={!singleName.trim() || !singlePhone.trim() || isAddingContact}
                      className="w-full"
                      size="lg"
                    >
                      {isAddingContact ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Adicionando...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar Contato
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>
              Revise os contatos antes de importar. {parsedContacts.length} contato(s) encontrado(s).
            </DialogDescription>
          </DialogHeader>

          {parseErrors.length > 0 && (
            <AlertBanner type="warning" title="Avisos">
              <ul className="list-inside list-disc">
                {parseErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertBanner>
          )}

          <ScrollArea className="max-h-[400px] rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Parte Contrária</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedContacts.map((contact, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                    <TableCell>{contact.lawyer_name || "-"}</TableCell>
                    <TableCell className="text-xs">{contact.process_number || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setParsedContacts(prev => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <LoadingSpinner size="sm" />
                  Importando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Importação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
