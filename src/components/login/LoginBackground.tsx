import { motion } from "framer-motion";

export function LoginBackground() {
  return (
    <div className="login-gradient absolute inset-0 overflow-hidden">
      {/* Orbe violeta — topo esquerdo (deriva lenta) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        className="login-orb absolute -left-40 -top-40 h-[640px] w-[640px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsl(263 70% 58% / 0.22) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Orbe ciano — eco da logo, base direita (deriva reversa) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.3 }}
        className="login-orb login-orb-slow absolute -bottom-48 -right-40 h-[720px] w-[720px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsl(190 90% 45% / 0.12) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Orbe violeta suave — centro */}
      <div
        className="absolute left-1/3 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsl(263 70% 60% / 0.07) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
