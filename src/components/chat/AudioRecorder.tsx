import { useRef, useState } from "react";
import { Mic, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AudioRecorderProps {
  disabled?: boolean;
  onSendAudio: (blob: Blob) => void;
  isSending?: boolean;
}

const ALLOWED_AUDIO_TYPES = [
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/webm",
  "audio/3gpp",
  "audio/amr",
];

export function AudioRecorder({ disabled, onSendAudio, isSending }: AudioRecorderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isAudio = ALLOWED_AUDIO_TYPES.some((t) => file.type.startsWith(t.split("/")[0]) && file.type.includes("audio"));
    if (!isAudio && !file.type.startsWith("audio/")) {
      toast.error("Selecione um arquivo de áudio válido (MP3, OGG, WAV, M4A, etc.)");
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancel = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSend = () => {
    if (!selectedFile) return;
    onSendAudio(selectedFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  // Preview mode
  if (selectedFile && previewUrl) {
    return (
      <div className="flex items-center gap-2 flex-1 px-2 py-1 rounded-2xl border bg-muted/50">
        <Mic className="h-4 w-4 shrink-0 text-primary" />
        <audio src={previewUrl} controls className="h-8 flex-1 min-w-0" style={{ maxWidth: 220 }} />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCancel}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          title="Descartar"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isSending}
          className="h-7 w-7 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
          title="Enviar como nota de voz"
          type="button"
        >
          {isSending ? <LoadingSpinner size="sm" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="shrink-0 h-10 w-10 rounded-full text-muted-foreground"
        title="Enviar áudio como nota de voz"
        type="button"
      >
        <Mic className="h-5 w-5" />
      </Button>
    </>
  );
}
