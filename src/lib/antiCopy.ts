/**
 * Frontend anti-copy / anti-inspect protections.
 * These are deterrents — they cannot fully prevent a determined attacker,
 * but they block casual copying, right-click inspection, and source viewing.
 */

export function initAntiCopyProtections() {
  // 1. Disable right-click context menu
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
  });

  // 2. Block common keyboard shortcuts for DevTools / View Source / Copy
  document.addEventListener("keydown", (e) => {
    // F12
    if (e.key === "F12") {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect)
    if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) {
      e.preventDefault();
      return false;
    }

    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key.toUpperCase() === "U") {
      e.preventDefault();
      return false;
    }

    // Ctrl+S (Save page)
    if (e.ctrlKey && e.key.toUpperCase() === "S") {
      e.preventDefault();
      return false;
    }

    // Ctrl+A (Select all) - except inside inputs/textareas
    if (e.ctrlKey && e.key.toUpperCase() === "A") {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        return false;
      }
    }

    // Ctrl+C, Ctrl+X (Copy/Cut) - except inside inputs/textareas/chat
    if (e.ctrlKey && ["C", "X"].includes(e.key.toUpperCase())) {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const selection = window.getSelection();
      const anchorEl = selection?.anchorNode instanceof HTMLElement 
        ? selection.anchorNode 
        : selection?.anchorNode?.parentElement;
      const inChat = !!anchorEl?.closest(".chat-selectable");
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !inChat) {
        e.preventDefault();
        return false;
      }
    }
  });

  // 3. Disable text selection (CSS-based, applied via class)
  document.body.classList.add("no-select");

  // 4. Disable drag
  document.addEventListener("dragstart", (e) => {
    e.preventDefault();
    return false;
  });

  // Helper: check if current selection is inside an allowed element
  const isSelectionInAllowedArea = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const anchorNode = selection.anchorNode;
    const element = anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
    if (!element) return false;
    const tag = element.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || !!element.closest(".chat-selectable");
  };

  // 5. Disable copy event (except in inputs/textareas/chat)
  document.addEventListener("copy", (e) => {
    if (!isSelectionInAllowedArea()) {
      e.preventDefault();
      return false;
    }
  });

  // 6. Disable cut event (except in inputs/textareas/chat)
  document.addEventListener("cut", (e) => {
    if (!isSelectionInAllowedArea()) {
      e.preventDefault();
      return false;
    }
  });

  // 7. DevTools detection — redirect if opened
  const threshold = 160;
  const detectDevTools = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    if (widthThreshold || heightThreshold) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#ef4444;font-family:system-ui;text-align:center;padding:2rem;">
          <div>
            <h1 style="font-size:2rem;margin-bottom:1rem;">⚠️ Acesso Bloqueado</h1>
            <p style="font-size:1.1rem;color:#999;">Ferramentas de desenvolvedor detectadas.<br/>Feche as ferramentas e recarregue a página.</p>
          </div>
        </div>
      `;
    }
  };

  setInterval(detectDevTools, 1500);

  // 8. Console warning
  console.log(
    "%c⚠️ PARE!",
    "color: red; font-size: 40px; font-weight: bold;"
  );
  console.log(
    "%cEsta é uma ferramenta de desenvolvedor. Se alguém lhe disse para copiar e colar algo aqui, isso é um golpe.",
    "color: #999; font-size: 16px;"
  );
}
