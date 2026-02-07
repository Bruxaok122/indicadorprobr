import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Lock, Mail, Eye, EyeOff, Scale, Shield, Zap, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import logoJuriszap from "@/assets/logo-juriszap.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, isAdmin } = useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    navigate(isAdmin ? "/administrador" : "/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn(email, password);
      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.message.includes("Invalid login credentials")) {
        setError("Email ou senha inválidos");
      } else if (err.message.includes("Email not confirmed")) {
        setError("Email não confirmado. Verifique sua caixa de entrada.");
      } else {
        setError(err.message || "Erro ao fazer login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: MessageSquare, title: "WhatsApp Integrado", desc: "Comunicação direta com clientes" },
    { icon: Shield, title: "Segurança Total", desc: "Dados protegidos e criptografados" },
    { icon: Zap, title: "Automação Inteligente", desc: "Templates e envios em massa" },
  ];

  return (
    <div className="flex min-h-screen overflow-hidden">
      {/* Left Panel — Branding & Features */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative hidden w-[55%] flex-col justify-between overflow-hidden lg:flex"
        style={{
          background: "linear-gradient(135deg, hsl(213 53% 18%) 0%, hsl(213 53% 24%) 40%, hsl(213 53% 30%) 100%)",
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full opacity-[0.07]"
            style={{ background: "radial-gradient(circle, hsl(43 84% 50%) 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-32 -right-32 h-[600px] w-[600px] rounded-full opacity-[0.05]"
            style={{ background: "radial-gradient(circle, hsl(43 84% 50%) 0%, transparent 70%)" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.04]"
            style={{ background: "radial-gradient(circle, hsl(0 0% 100%) 0%, transparent 70%)" }}
          />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-20">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="mb-10 flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-2xl"
                style={{
                  background: "linear-gradient(135deg, hsl(43 84% 45%) 0%, hsl(43 84% 55%) 100%)",
                  boxShadow: "0 8px 32px hsla(43, 84%, 38%, 0.4)",
                }}
              >
                <Scale className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">JurisZap</h1>
                <p className="text-sm font-medium text-white/50">Sistema de Comunicação Jurídica</p>
              </div>
            </div>

            <h2 className="mb-4 text-4xl font-bold leading-tight text-white xl:text-5xl">
              Sua advocacia,{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(135deg, hsl(43 84% 55%) 0%, hsl(43 84% 70%) 100%)",
                }}
              >
                conectada.
              </span>
            </h2>
            <p className="mb-12 max-w-md text-lg leading-relaxed text-white/60">
              Gerencie suas comunicações jurídicas com eficiência, segurança e elegância em uma única plataforma.
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="space-y-5"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.15, duration: 0.5 }}
                className="flex items-center gap-4 rounded-xl px-5 py-4 backdrop-blur-sm"
                style={{ background: "hsla(0, 0%, 100%, 0.06)", border: "1px solid hsla(0, 0%, 100%, 0.08)" }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "hsla(43, 84%, 50%, 0.15)" }}
                >
                  <feature.icon className="h-5 w-5" style={{ color: "hsl(43, 84%, 60%)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{feature.title}</p>
                  <p className="text-xs text-white/50">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Footer on left panel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="relative z-10 px-12 pb-8 xl:px-20"
        >
          <p className="text-xs text-white/30">
            © 2025 JurisZap · Desenvolvido por{" "}
            <span className="font-semibold" style={{ color: "hsl(43 84% 55%)" }}>
              LB013
            </span>
          </p>
        </motion.div>
      </motion.div>

      {/* Right Panel — Login Form */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-background p-6 sm:p-8">
        {/* Subtle decorative gradient on right panel */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse at 70% 20%, hsla(213, 53%, 24%, 0.06) 0%, transparent 60%), radial-gradient(ellipse at 30% 80%, hsla(43, 84%, 50%, 0.04) 0%, transparent 60%)",
          }}
        />

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10 w-full max-w-[420px]"
        >
          {/* Mobile logo (visible only on small screens) */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
              style={{
                background: "linear-gradient(135deg, hsl(213 53% 24%) 0%, hsl(213 53% 30%) 100%)",
              }}
            >
              <Scale className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">JurisZap</h1>
            <p className="text-sm text-muted-foreground">Sistema de Comunicação Jurídica</p>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-muted-foreground">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <AlertBanner type="error" title="Erro">
                  {error}
                </AlertBanner>
              </motion.div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-border/60 bg-card pl-11 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:border-primary/30 focus-visible:ring-primary/20"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-border/60 bg-card pl-11 pr-11 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground/60 focus-visible:border-primary/30 focus-visible:ring-primary/20"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="relative h-12 w-full overflow-hidden text-sm font-semibold shadow-lg transition-all duration-300 hover:shadow-xl"
              style={{
                background: "linear-gradient(135deg, hsl(213 53% 24%) 0%, hsl(213 53% 32%) 100%)",
                boxShadow: "0 4px 20px hsla(213, 53%, 24%, 0.3)",
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
              Acesso Seguro
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-5 flex items-center justify-center gap-2 rounded-xl px-4 py-3"
            style={{ background: "hsla(142, 71%, 45%, 0.06)", border: "1px solid hsla(142, 71%, 45%, 0.12)" }}
          >
            <Shield className="h-4 w-4 text-success" />
            <p className="text-xs text-muted-foreground">
              Conexão protegida com criptografia de ponta a ponta
            </p>
          </motion.div>

          {/* Mobile footer */}
          <div className="mt-8 text-center lg:hidden">
            <p className="text-xs text-muted-foreground">
              Desenvolvido por{" "}
              <span className="font-semibold text-accent">LB013</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
