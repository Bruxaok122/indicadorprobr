import { useState, useRef, useCallback } from "react";
import { Mic, Square, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AudioRecorderProps {
  disabled?: boolean;
  onSendAudio: (blob: Blob) => void;
  isSending?: boolean;
}

type RecorderState = "idle" | "recording" | "preview";

export function AudioRecorder({ disabled, onSendAudio, isSending }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer ogg/opus for WhatsApp PTT compatibility
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        audioBlobRef.current = blob;
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(blob);
        setState("preview");
      };

      recorder.start(250);
      setState("recording");
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      toast.error("Não foi possível acessar o microfone");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      // Prevent onstop from setting preview state
      const recorder = mediaRecorderRef.current;
      recorder.onstop = () => {
        recorder.stream?.getTracks().forEach((t) => t.stop());
      };
      recorder.stop();
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    audioBlobRef.current = null;
    setState("idle");
    setDuration(0);
  }, []);

  const sendAudio = useCallback(() => {
    if (audioBlobRef.current) {
      onSendAudio(audioBlobRef.current);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      audioBlobRef.current = null;
      setState("idle");
      setDuration(0);
    }
  }, [onSendAudio]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (state === "idle") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={startRecording}
        disabled={disabled}
        className="shrink-0 h-10 w-10 rounded-full text-muted-foreground"
        title="Gravar áudio"
        type="button"
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-destructive/10 border border-destructive/30">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
        </span>
        <span className="text-sm font-mono text-destructive min-w-[2.5rem]">{formatTime(duration)}</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={cancelRecording}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          title="Cancelar"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={stopRecording}
          className="h-7 w-7 bg-destructive hover:bg-destructive/90 text-white rounded-full"
          title="Parar gravação"
          type="button"
        >
          <Square className="h-3 w-3 fill-white" />
        </Button>
      </div>
    );
  }

  // Preview state
  return (
    <div className="flex items-center gap-2 flex-1 px-2 py-1 rounded-full bg-muted/50 border">
      <audio
        src={audioUrlRef.current || ""}
        controls
        className="h-8 flex-1 min-w-0"
        style={{ maxWidth: "100%" }}
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={cancelRecording}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        title="Descartar"
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        onClick={sendAudio}
        disabled={isSending}
        className={cn(
          "h-7 w-7 shrink-0 rounded-full",
          "bg-primary hover:bg-primary/90 text-primary-foreground"
        )}
        title="Enviar áudio"
        type="button"
      >
        <Send className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
