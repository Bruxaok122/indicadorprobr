import { Fragment, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Video, MoreVertical, CheckCheck, ExternalLink, Reply } from "lucide-react";
import type { MetaTemplate } from "@/hooks/useMetaTemplates";

export interface WhatsAppPhonePreviewProps {
  template: MetaTemplate | null;
  body: string;
  /** Map of variable number → display value (already resolved). */
  values: Record<string, string>;
  senderName: string;
  photoUrl?: string;
}

interface TemplateButton { type?: string; text?: string }

/** Renders WhatsApp *bold*, _italic_, ~strike~ inline formatting. */
function formatWa(text: string): ReactNode[] {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return parts.map((p, i) => {
    if (/^\*[^*]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
    if (/^_[^_]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^~[^~]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function WhatsAppPhonePreview({ template, body, values, senderName, photoUrl }: WhatsAppPhonePreviewProps) {
  const comps = template?.components ?? [];
  const header = comps.find((c) => c.type === "HEADER" && c.format === "TEXT")?.text;
  const footer = comps.find((c) => c.type === "FOOTER")?.text;
  const btnComp = comps.find((c) => c.type === "BUTTONS") as { buttons?: TemplateButton[] } | undefined;
  const buttons = btnComp?.buttons ?? [];

  // Split body into text + highlighted variable values
  const segments = body.split(/(\{\{\d+\}\})/g);
  const initials = senderName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "JZ";

  return (
    <div className="relative mx-auto w-[280px] select-none">
      <div className="absolute -inset-6 rounded-[3rem] bg-primary/20 blur-3xl" aria-hidden />
      <div className="relative rounded-[2.6rem] border border-border/60 bg-gradient-to-b from-muted to-background p-2.5 shadow-2xl">
        <div className="absolute left-1/2 top-3.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-background" aria-hidden />
        <div className="wa-screen relative flex h-[min(470px,calc(100dvh-230px))] flex-col overflow-hidden rounded-[2.1rem]">
          {/* Chat header */}
          <div className="wa-header flex items-center gap-2 px-3 pb-2.5 pt-10">
            <ArrowLeft className="h-4 w-4" />
            {photoUrl ? (
              <img src={photoUrl} alt="Foto do perfil" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="wa-avatar flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold">{initials}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{senderName || "Seu número"}</p>
              <p className="text-[10px] opacity-75">conta comercial</p>
            </div>
            <Video className="h-4 w-4" /><Phone className="h-4 w-4" /><MoreVertical className="h-4 w-4" />
          </div>

          {/* Chat body */}
          <div className="wa-wallpaper flex-1 overflow-y-auto px-3 py-4">
            {!template ? (
              <p className="wa-chip mx-auto mt-24 w-fit rounded-lg px-3 py-1.5 text-center text-[11px]">Selecione um template para ver a prévia</p>
            ) : (
              <motion.div key={template.name} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="max-w-[88%]">
                <div className="wa-bubble rounded-lg rounded-tl-none px-2.5 pb-1.5 pt-2 text-[12.5px] leading-snug shadow-sm">
                  {header && <p className="mb-1 font-bold">{header}</p>}
                  <p className="whitespace-pre-wrap break-words">
                    {segments.map((s, i) => {
                      const m = s.match(/^\{\{(\d+)\}\}$/);
                      if (!m) return <Fragment key={i}>{formatWa(s)}</Fragment>;
                      const val = values[m[1]];
                      return (
                        <motion.span key={`${i}-${val ?? ""}`} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className={val ? "wa-var-filled rounded px-0.5" : "wa-var-empty rounded px-0.5"}>
                          {val || s}
                        </motion.span>
                      );
                    })}
                  </p>
                  {footer && <p className="mt-1 text-[10.5px] opacity-60">{footer}</p>}
                  <div className="flex justify-end"><CheckCheck className="wa-ticks h-3.5 w-3.5" /></div>
                </div>
                {buttons.map((b, i) => (
                  <div key={i} className="wa-bubble wa-btn mt-0.5 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium shadow-sm">
                    {b.type === "URL" ? <ExternalLink className="h-3.5 w-3.5" /> : <Reply className="h-3.5 w-3.5" />}
                    {b.text}
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Composer */}
          <div className="wa-wallpaper flex items-center gap-2 px-2 pb-4 pt-1">
            <div className="wa-input flex-1 rounded-full px-3 py-2 text-[11px] opacity-80">Mensagem</div>
            <div className="wa-send h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
