import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Lock, Mail, Eye, EyeOff, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import logoAsset from "@/assets/logo-juriszap.png.asset.json";

export function LoginGlassCard() {
  const navigate = useNavigate();
  const { signIn } = useAuthContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <motion.div
      initial={{ y: 40, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="login-border-glow relative w-full max-w-[440px] rounded-3xl p-6 sm:p-8 lg:p-10"
      style={{
        background:
          "linear-gradient(160deg, hsl(258 28% 13% / 0.75), hsl(245 30% 6% / 0.85))",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        border: "1px solid hsl(263 70% 65% / 0.18)",
        boxShadow:
          "0 32px 80px -16px hsl(245 30% 3% / 0.8), 0 0 60px -20px hsl(263 70% 58% / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.07)",
      }}
    >
      {/* Logo & branding — nova logo oficial */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="mb-6 lg:mb-8 flex flex-col items-center text-center"
      >
        <div className="relative mb-4">
          {/* Halo pulsante atrás da logo */}
          <div
            className="login-logo-pulse absolute inset-0 rounded-2xl"
            style={{
              background:
                "radial-gradient(circle, hsl(263 70% 58% / 0.5) 0%, transparent 70%)",
              filter: "blur(14px)",
            }}
          />
          <motion.img
            src={logoAsset.url}
            alt="JurisZap"
            initial={{ scale: 0.8, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-16 w-16 rounded-2xl"
            style={{
              border: "1px solid hsl(263 70% 65% / 0.35)",
              boxShadow:
                "0 10px 30px -8px hsl(263 70% 58% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.1)",
            }}
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          JurisZap
        </h1>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.25em] text-white/40">
          Comunicação Jurídica
        </p>
      </motion.div>

      {/* Welcome text */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mb-6 lg:mb-8 text-center"
      >
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          Bem-vindo de volta
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Insira suas credenciais para acessar o sistema
        </p>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        onSubmit={handleSubmit}
        className="space-y-4 lg:space-y-5"
      >
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "hsl(0 70% 50% / 0.12)",
                border: "1px solid hsl(0 70% 50% / 0.25)",
                color: "hsl(0 85% 75%)",
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {/* Email field */}
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-xs font-semibold uppercase tracking-wider text-white/60"
          >
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border-white/10 bg-white/[0.06] pl-11 text-base text-white shadow-sm transition-all duration-300 placeholder:text-white/25 focus-visible:border-violet/50 focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-violet/25"
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-xs font-semibold uppercase tracking-wider text-white/60"
          >
            Senha
          </Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-white/10 bg-white/[0.06] pl-11 pr-11 text-base text-white shadow-sm transition-all duration-300 placeholder:text-white/25 focus-visible:border-violet/50 focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-violet/25"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="group relative h-12 w-full overflow-hidden rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, hsl(263 70% 52%) 0%, hsl(263 70% 64%) 100%)",
            boxShadow:
              "0 8px 32px hsl(263 70% 50% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.2)",
          }}
        >
          {/* Shine sweep */}
          <div
            className="login-shine absolute inset-y-0 w-1/3 opacity-0 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / 0.18) 50%, transparent 100%)",
            }}
          />
          {isLoading ? (
            <span className="relative flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Entrando...
            </span>
          ) : (
            <span className="relative">Entrar</span>
          )}
        </button>
      </motion.form>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-6 lg:mt-8 flex items-center gap-3"
      >
        <div className="h-px flex-1 bg-white/10" />
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
          <ShieldCheck className="h-3 w-3" />
          Acesso Seguro
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="mt-5 text-center text-[11px] text-white/25"
      >
        © 2026 JurisZap
      </motion.p>
    </motion.div>
  );
}
