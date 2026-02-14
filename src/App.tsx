import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ConfiguracaoPage from "./pages/ConfiguracaoPage";
import ImportarPage from "./pages/ImportarPage";
import ContatosPage from "./pages/ContatosPage";
import ConversasPage from "./pages/ConversasPage";
import TemplatesPage from "./pages/TemplatesPage";
import WebhookPage from "./pages/WebhookPage";
import WhatsAppApiPage from "./pages/WhatsAppApiPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/administrador"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracao"
              element={
                <ProtectedRoute>
                  <ConfiguracaoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/importar"
              element={
                <ProtectedRoute>
                  <ImportarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contatos"
              element={
                <ProtectedRoute>
                  <ContatosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conversas"
              element={
                <ProtectedRoute>
                  <ConversasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <TemplatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp-api"
              element={
                <ProtectedRoute>
                  <WhatsAppApiPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/webhook"
              element={
                <ProtectedRoute>
                  <WebhookPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
