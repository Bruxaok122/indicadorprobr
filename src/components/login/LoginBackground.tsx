import { motion } from "framer-motion";

export function LoginBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Deep gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(213 53% 8%) 0%, hsl(213 53% 14%) 30%, hsl(213 40% 18%) 60%, hsl(220 30% 12%) 100%)",
        }}
      />

      {/* Ambient gold glow — top left */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsla(43, 84%, 50%, 0.12) 0%, transparent 70%)",
        }}
      />

      {/* Ambient blue glow — bottom right */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, delay: 0.3 }}
        className="absolute -bottom-40 -right-40 h-[700px] w-[700px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsla(213, 53%, 30%, 0.2) 0%, transparent 70%)",
        }}
      />

      {/* Subtle center glow */}
      <div
        className="absolute left-1/3 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsla(43, 84%, 50%, 0.05) 0%, transparent 70%)",
        }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
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
