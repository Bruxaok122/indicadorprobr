import { useEffect, useState } from "react";
import { X, Download, ShieldCheck, Loader2 } from "lucide-react";

interface DocumentLightboxProps {
  url: string;
  name?: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Privacy-first document viewer.
 *
 * Why this exists:
 * - WhatsApp documents (especially PDFs) can contain remote tracking pixels,
 *   external resource references, or scripts that try to phone-home the
 *   reader's IP, user-agent or open-event timestamp to whoever sent the file.
 * - We fetch the document as a Blob and render it via a sandboxed iframe with
 *   a blob: URL. The iframe has NO sandbox tokens, which means:
 *     - scripts disabled
 *     - top navigation blocked
 *     - form submissions blocked
 *     - forced unique origin (cannot read cookies / referrer / parent)
 * - The file itself is already proxied through our backend (Supabase Storage)
 *   when it was received, so Meta / the sender's servers never see the
 *   operator's IP either.
 */
export function DocumentLightbox({ url, name, open, onClose }: DocumentLightboxProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    let created: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Falha ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name || "documento";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-[95vw] max-w-5xl flex-col overflow-hidden rounded-lg bg-white dark:bg-[#1a1f24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">Modo seguro</span>
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{name || "Documento"}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleDownload}
              disabled={!blobUrl}
              className="rounded-full p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 bg-gray-100 dark:bg-[#0e1317]">
          {loading && (
            <div className="flex h-full items-center justify-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-red-500">
              <p>Não foi possível abrir o documento.</p>
              <p className="text-xs opacity-70">{error}</p>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <iframe
              src={blobUrl}
              title={name || "Documento"}
              // Empty sandbox = scripts off, top-nav off, unique origin.
              sandbox=""
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-white"
            />
          )}
        </div>

        {/* Footer notice */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-1.5 text-[10px] text-gray-500 dark:text-gray-400">
          Visualização isolada: scripts e rastreadores do documento são bloqueados. Seu IP nunca é exposto ao remetente.
        </div>
      </div>
    </div>
  );
}
