import { useRef, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Mic, MicOff, Upload, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function AdminAudioPage() {
  const { users } = useAdmin();
  const queryClient = useQueryClient();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [uploadingForUserId, setUploadingForUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [audioTargetUserId, setAudioTargetUserId] = useState<string | null>(null);

  const { data: audioConfigs = [], isLoading: loadingAudio } = useQuery({
    queryKey: ["admin-audio-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audio_config" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as { id: string; audio_url: string; audio_name: string; user_id: string | null }[];
    },
  });

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || audioTargetUserId === null) return;
    // Accept Opus voice files (.ogg/.opus) to preserve native WhatsApp voice-note rendering
    const fileName = file.name.toLowerCase();
    const mime = file.type.toLowerCase();
    const isOpusVoice =
      fileName.endsWith(".ogg") ||
      fileName.endsWith(".opus") ||
      mime.includes("audio/ogg") ||
      mime.includes("audio/opus");
    if (!isOpusVoice) {
      toast.error("Formato inválido! Use áudio Opus (.ogg ou .opus)", {
        description: "Somente áudio Opus aparece como nota de voz nativa no WhatsApp."
      });
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }
    setUploadingForUserId(audioTargetUserId);
    try {
      const filePath = `audio/admin-config/${audioTargetUserId}/${Date.now()}-${file.name}`;
      const contentType = "audio/ogg";
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath);
      const audioUrl = urlData.publicUrl;

      const existing = audioConfigs.find((a) => a.user_id === audioTargetUserId);
      if (existing?.id) {
        await supabase.from("admin_audio_config" as any).delete().eq("id", existing.id);
      }

      const { error: insertError } = await supabase.from("admin_audio_config" as any).insert({
        audio_url: audioUrl,
        audio_name: file.name,
        user_id: audioTargetUserId,
      });
      if (insertError) throw insertError;

      toast.success("Áudio configurado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-audio-configs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-config"] });
    } catch (err: any) {
      toast.error("Erro ao salvar áudio", { description: err.message });
    } finally {
      setUploadingForUserId(null);
      setAudioTargetUserId(null);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  const handleDeleteAudio = async (id: string) => {
    setDeletingId(id);
    try {
      await supabase.from("admin_audio_config" as any).delete().eq("id", id);
      toast.success("Áudio removido");
      queryClient.invalidateQueries({ queryKey: ["admin-audio-configs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audio-config"] });
    } catch (err: any) {
      toast.error("Erro ao remover áudio", { description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  const triggerUploadForUser = (userId: string) => {
    setAudioTargetUserId(userId);
    setTimeout(() => audioInputRef.current?.click(), 50);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" />
          Áudio dos Operadores
        </h2>
         <p className="text-sm text-muted-foreground mt-1">
           Defina um arquivo de áudio <strong>.ogg (Opus)</strong> para cada operador. Apenas este formato aparece como nota de voz nativa no WhatsApp.
         </p>
         <p className="text-xs text-muted-foreground/70 mt-0.5">
           Converta MP3/WAV para OGG em: <a href="https://convertio.co/mp3-ogg/" target="_blank" rel="noopener noreferrer" className="underline text-primary">convertio.co/mp3-ogg</a>
         </p>
      </div>

      <input
        ref={audioInputRef}
        type="file"
        accept=".ogg,audio/ogg"
        className="hidden"
        onChange={handleAudioUpload}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            Configuração por Operador
          </CardTitle>
          <CardDescription>
            Cada operador pode ter seu próprio áudio de voz para envio rápido no chat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAudio ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" text="Carregando áudios..." />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum operador cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const audioEntry = audioConfigs.find((a) => a.user_id === user.user_id);
                const isUploading = uploadingForUserId === user.user_id;
                const isDeleting = audioEntry ? deletingId === audioEntry.id : false;
                return (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {audioEntry ? (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <MicOff className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.full_name}</p>
                        {audioEntry ? (
                          <p className="text-xs text-muted-foreground truncate">{audioEntry.audio_name}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 italic">Sem áudio configurado</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {audioEntry && (
                        <audio
                          src={audioEntry.audio_url}
                          controls
                          className="h-8 max-w-[160px]"
                          style={{ minWidth: 0 }}
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => triggerUploadForUser(user.user_id)}
                        disabled={isUploading}
                      >
                        {isUploading ? <LoadingSpinner size="sm" /> : <Upload className="h-3 w-3" />}
                        {audioEntry ? "Substituir" : "Carregar"}
                      </Button>
                      {audioEntry && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteAudio(audioEntry.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
