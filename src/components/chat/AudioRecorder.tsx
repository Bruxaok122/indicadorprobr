import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface AudioRecorderProps {
  onSendAudio: (blob: Blob) => void;
  isSending?: boolean;
}

export function AudioRecorder({ onSendAudio, isSending }: AudioRecorderProps) {
  const [isFetching, setIsFetching] = useState(false);

  // Fetch the configured audio from admin
  const { data: audioConfig } = useQuery({
    queryKey: ["admin-audio-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audio_config" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as unknown as { id: string; audio_url: string; audio_name: string } | null;
    },
  });

  const hasAudio = !!audioConfig?.audio_url;

  const handleClick = async () => {
    if (!audioConfig?.audio_url) return;
    setIsFetching(true);
    try {
      const response = await fetch(audioConfig.audio_url);
      if (!response.ok) throw new Error("Falha ao carregar o áudio");
      const blob = await response.blob();
      onSendAudio(blob);
    } catch (err: any) {
      toast.error("Erro ao carregar áudio", { description: err.message });
    } finally {
      setIsFetching(false);
    }
  };

  const isLoading = isFetching || isSending;

  const button = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={!hasAudio || isLoading}
      className="shrink-0 h-10 w-10 rounded-full text-muted-foreground"
      title={hasAudio ? "Enviar áudio de voz" : "Nenhum áudio configurado pelo admin"}
      type="button"
    >
      {isLoading ? (
        <LoadingSpinner size="sm" />
      ) : hasAudio ? (
        <Mic className="h-5 w-5" />
      ) : (
        <MicOff className="h-5 w-5 opacity-40" />
      )}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        {hasAudio
          ? `Enviar: ${audioConfig.audio_name}`
          : "Nenhum áudio configurado"}
      </TooltipContent>
    </Tooltip>
  );
}
