import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAntiCopyProtections } from "./lib/antiCopy";

// Initialize anti-copy protections in production
if (import.meta.env.PROD) {
  initAntiCopyProtections();
}

createRoot(document.getElementById("root")!).render(<App />);
