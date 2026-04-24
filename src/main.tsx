import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-time theme reset: force light mode for everyone (v2)
const THEME_RESET_KEY = "theme-reset-v2";
if (!localStorage.getItem(THEME_RESET_KEY)) {
  localStorage.setItem("theme", "light");
  localStorage.setItem(THEME_RESET_KEY, "1");
  document.documentElement.classList.remove("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
