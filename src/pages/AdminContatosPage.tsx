import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parseJuridicalList } from "@/lib/parseJuridicalList";
import { ParsedContact } from "@/types/juriszap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertBanner } from "@/components/ui/alert-banner";
import {
  Upload, UserPlus, File, Plus, User, Phone, Scale,
  CheckCircle, Search, Trash2, ContactRound, List, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

interface ContactList {
  name: string;
  count: number;
}

export default function AdminContatosPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List management
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  // Local lists: lists created but not yet saved (no contacts yet)
  const [localLists, setLocalLists] = useState<string[]>([]);

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

  // Search
  const [search, setSearch] = useState("");

  // Fetch all admin pool contacts (user_id is null)
  const { data: allContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["admin-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .is("user_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Derive lists from contacts, merged with local empty lists
  const lists: ContactList[] = (() => {
    const map: Record<string, number> = {};
    // Seed with local lists at count 0
    localLists.forEach((name) => { map[name] = 0; });
    (allContacts as any[]).forEach((c) => {
      const listName = c.contact_list;
      if (!listName) return;
      map[listName] = (map[listName] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  })();

  // Filtered contacts for selected list
  const displayedContacts = selectedList
    ? (allContacts as any[]).filter((c) => {
        if (!search) return c.contact_list === selectedList;
        return (
          c.contact_list === selectedList &&
          (c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
        );
      })
    : [];

  const addContactMutation = useMutation({
    mutationFn: async (contact: { name: string; phone: string; lawyer_name?: string; process_number?: string; contact_list: string }) => {
      const { error } = await supabase.from("contacts").insert({
        name: contact.name,
        phone: contact.phone,
        lawyer_name: contact.lawyer_name,
        process_number: contact.process_number,
        contact_list: contact.contact_list,
        status: "novo",
        user_id: null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato adicionado!");
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setSingleName(""); setSinglePhone(""); setSingleLawyer(""); setSingleProcess("");
    },
    onError: (e: any) => toast.error("Erro ao adicionar contato", { description: e.message }),
  });

  const importContactsMutation = useMutation({
    mutationFn: async ({ contacts, listName }: { contacts: ParsedContact[]; listName: string }) => {
      let ok = 0; let fail = 0;
      for (const c of contacts) {
        const { error } = await supabase.from("contacts").insert({
          name: c.name,
          phone: c.phone,
          lawyer_name: c.lawyer_name,
          process_number: c.process_number,
          contact_list: listName,
          status: "novo",
          user_id: null,
        } as any);
        if (error) fail++; else ok++;
      }
      await supabase.from("import_logs").insert({ total_contacts: contacts.length, successful: ok, failed: fail });
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      toast.success(`Importação concluída: ${ok} importados, ${fail} falhas`);
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setRawText(""); setParsedContacts([]); setParseErrors([]); setShowPreview(false);
    },
    onError: (e: any) => toast.error("Erro na importação", { description: e.message }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato removido");
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
    },
    onError: (e: any) => toast.error("Erro ao remover", { description: e.message }),
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listName: string) => {
      const ids = (allContacts as any[])
        .filter((c) => c.contact_list === listName)
        .map((c) => c.id);
      if (ids.length > 0) {
        const { error } = await supabase.from("contacts").delete().in("id", ids);
        if (error) throw error;
      }
    },
    onSuccess: (_, listName) => {
      toast.success("Lista excluída com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      // Remove from local lists too
      setLocalLists((prev) => prev.filter((l) => l !== listName));
      setSelectedList(null);
      setListToDelete(null);
    },
    onError: (e: any) => toast.error("Erro ao excluir lista", { description: e.message }),
  });

  const handleParse = () => {
    const { contacts, errors } = parseJuridicalList(rawText);
    setParsedContacts(contacts);
    setParseErrors(errors);
    if (contacts.length > 0) setShowPreview(true);
    else toast.warning("Nenhum contato encontrado");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) { toast.error("Apenas arquivos .txt"); return; }
    setIsLoadingFile(true);
    try {
      const text = await file.text();
      setRawText(text);
      const { contacts, errors } = parseJuridicalList(text);
      setParsedContacts(contacts);
      setParseErrors(errors);
      if (contacts.length > 0) { setShowPreview(true); toast.success(`${contacts.length} contato(s) encontrado(s)`); }
      else toast.warning("Nenhum contato encontrado");
    } catch { toast.error("Erro ao ler arquivo"); }
    finally { setIsLoadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleAddSingle = () => {
    if (!singleName.trim() || !singlePhone.trim() || !selectedList) return;
    let phone = singlePhone.replace(/\D/g, "");
    if (phone.length === 11) phone = "55" + phone;
    else if (phone.length === 10) phone = "55" + phone.slice(0, 2) + "9" + phone.slice(2);
    else if (!phone.startsWith("55")) phone = "55" + phone;

    addContactMutation.mutate({
      name: singleName.trim(),
      phone,
      lawyer_name: singleLawyer.trim() || undefined,
      process_number: singleProcess.trim() || undefined,
      contact_list: selectedList,
    });
  };

  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) return;
    // Add to local lists so it persists in sidebar even before first contact is added
    setLocalLists((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSelectedList(name);
    setNewListName("");
    setShowNewList(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ContactRound className="h-5 w-5 text-primary" />
          Contatos
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os contatos por lista para uso nos disparos.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left: Lists sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-1.5">
              <List className="h-4 w-4" /> Listas
            </CardTitle>
            <CardDescription>Grupos de contatos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {lists.length === 0 && !showNewList && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma lista criada</p>
            )}
            {lists.map((list) => (
              <div
                key={list.name}
                className={`group w-full flex justify-between items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${selectedList === list.name ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onClick={() => setSelectedList(list.name)}
              >
                <span className="truncate font-medium">{list.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="secondary" className="text-xs">{list.count}</Badge>
                  <button
                    onClick={(e) => { e.stopPropagation(); setListToDelete(list.name); }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-destructive ${selectedList === list.name ? "text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}

            {showNewList ? (
              <div className="pt-2 space-y-1">
                <Input
                  placeholder="Nome da lista..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateList(); }}
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreateList}>Criar</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNewList(false)}>✕</Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 mt-1" onClick={() => setShowNewList(true)}>
                <Plus className="h-3 w-3" /> Nova lista
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Right: Contacts + Add */}
        <div className="lg:col-span-3 space-y-4">
          {!selectedList ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <List className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="font-medium text-muted-foreground">Selecione ou crie uma lista</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Escolha uma lista na barra lateral ou crie uma nova para começar.
                </p>
                <Button variant="outline" className="mt-4 gap-1.5" onClick={() => setShowNewList(true)}>
                  <Plus className="h-4 w-4" /> Nova lista
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Add contacts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Adicionar Contatos</CardTitle>
                  <CardDescription>
                    Adicionando à lista: <span className="font-semibold text-foreground">{selectedList}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="individual">
                    <TabsList className="w-full">
                      <TabsTrigger value="individual" className="flex-1 gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" /> Individual
                      </TabsTrigger>
                      <TabsTrigger value="lista" className="flex-1 gap-1.5">
                        <Upload className="h-3.5 w-3.5" /> Importar Lista
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="individual" className="mt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Ex: Maria Santos" value={singleName} onChange={(e) => setSingleName(e.target.value)} className="pl-8 h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Telefone <span className="text-destructive">*</span></Label>
                          <div className="relative">
                            <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="(11) 99999-8888" value={singlePhone} onChange={(e) => setSinglePhone(e.target.value)} className="pl-8 h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Advogado</Label>
                          <div className="relative">
                            <Scale className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Dr. João Silva" value={singleLawyer} onChange={(e) => setSingleLawyer(e.target.value)} className="pl-8 h-9 text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Processo</Label>
                          <Input placeholder="1234567-89.2024.8.26.0100" value={singleProcess} onChange={(e) => setSingleProcess(e.target.value)} className="h-9 text-sm" />
                        </div>
                      </div>
                      <Button
                        className="w-full mt-3"
                        onClick={handleAddSingle}
                        disabled={!singleName.trim() || !singlePhone.trim() || addContactMutation.isPending}
                      >
                        {addContactMutation.isPending ? <LoadingSpinner size="sm" /> : <><Plus className="h-4 w-4 mr-1.5" /> Adicionar Contato</>}
                      </Button>
                    </TabsContent>

                    <TabsContent value="lista" className="mt-4 space-y-3">
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt" className="hidden" />
                      <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isLoadingFile}>
                        {isLoadingFile ? <LoadingSpinner size="sm" /> : <><File className="h-4 w-4 mr-1.5" /> Carregar Arquivo .txt</>}
                      </Button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">ou cole o texto</span>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Cole aqui a lista no formato jurídico com separadores ================"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        className="min-h-[120px] font-mono text-xs"
                      />
                      <Button className="w-full" onClick={handleParse} disabled={!rawText.trim()}>
                        <Upload className="h-4 w-4 mr-1.5" /> Processar Lista
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Contacts table */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{selectedList}</CardTitle>
                      <CardDescription>{displayedContacts.length} contato(s)</CardDescription>
                    </div>
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingContacts ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : displayedContacts.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-center text-muted-foreground">
                      <ContactRound className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Nenhum contato nesta lista</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-72">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead className="hidden md:table-cell">Advogado</TableHead>
                            <TableHead className="hidden lg:table-cell">Processo</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedContacts.map((c: any) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-medium text-sm">{c.name}</TableCell>
                              <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{c.lawyer_name || "-"}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{c.process_number || "-"}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteContactMutation.mutate(c.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>
              {parsedContacts.length} contato(s) encontrado(s).
              {selectedList && <> Serão adicionados à lista <strong>{selectedList}</strong>.</>}
            </DialogDescription>
          </DialogHeader>
          {parseErrors.length > 0 && (
            <AlertBanner type="warning" title="Avisos">
              <ul className="list-inside list-disc text-xs">
                {parseErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </AlertBanner>
          )}
          <ScrollArea className="max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Advogado</TableHead>
                  <TableHead>Processo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedContacts.slice(0, 50).map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                    <TableCell className="text-xs">{c.lawyer_name || "-"}</TableCell>
                    <TableCell className="text-xs">{c.process_number || "-"}</TableCell>
                  </TableRow>
                ))}
                {parsedContacts.length > 50 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">... e mais {parsedContacts.length - 50} contatos</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Cancelar</Button>
            <Button
              onClick={() => selectedList && importContactsMutation.mutate({ contacts: parsedContacts, listName: selectedList })}
              disabled={importContactsMutation.isPending || !selectedList}
            >
              {importContactsMutation.isPending ? <LoadingSpinner size="sm" /> : <><CheckCircle className="h-4 w-4 mr-1.5" /> Importar {parsedContacts.length} contatos</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete List Confirm Dialog */}
      <Dialog open={!!listToDelete} onOpenChange={(open) => !open && setListToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir lista "{listToDelete}"?
            </DialogTitle>
            <DialogDescription>
              Esta ação irá excluir permanentemente todos os contatos dentro desta lista.
              {listToDelete && (() => {
                const count = lists.find(l => l.name === listToDelete)?.count || 0;
                return count > 0 ? <strong className="block mt-1"> {count} contato(s) serão removidos.</strong> : null;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListToDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => listToDelete && deleteListMutation.mutate(listToDelete)}
              disabled={deleteListMutation.isPending}
            >
              {deleteListMutation.isPending ? <LoadingSpinner size="sm" /> : <><Trash2 className="h-4 w-4 mr-1.5" /> Excluir lista</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
