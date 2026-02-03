import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ConfiguracaoPage from "./pages/ConfiguracaoPage";
import ImportarPage from "./pages/ImportarPage";
import ContatosPage from "./pages/ContatosPage";
import ConversasPage from "./pages/ConversasPage";
import TemplatesPage from "./pages/TemplatesPage";
import WebhookPage from "./pages/WebhookPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/configuracao" element={<ConfiguracaoPage />} />
          <Route path="/importar" element={<ImportarPage />} />
          <Route path="/contatos" element={<ContatosPage />} />
          <Route path="/conversas" element={<ConversasPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/webhook" element={<WebhookPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
