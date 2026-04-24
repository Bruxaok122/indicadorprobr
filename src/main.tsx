import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// One-time theme reset: force dark mode (default) for everyone (v3)
const THEME_RESET_KEY = "theme-reset-v3";
if (!localStorage.getItem(THEME_RESET_KEY)) {
  localStorage.setItem("theme", "dark");
  localStorage.setItem(THEME_RESET_KEY, "1");
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
