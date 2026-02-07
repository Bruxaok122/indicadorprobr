import { motion } from "framer-motion";
import lawyerHero from "@/assets/lawyer-hero.png";

export function LoginHeroImage() {
  return (
    <motion.div
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      className="hidden items-end justify-center lg:flex"
      style={{ position: "relative" }}
    >
      {/* Glow behind the person */}
      <div
        className="absolute bottom-0 left-1/2 h-[70%] w-[80%] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center bottom, hsla(43, 84%, 50%, 0.08) 0%, transparent 70%)",
        }}
      />

      <img
        src={lawyerHero}
        alt="Advogado profissional"
        className="relative z-10 h-auto max-h-[85vh] w-auto max-w-full object-contain drop-shadow-2xl"
        style={{
          filter: "drop-shadow(0 20px 60px hsla(213, 53%, 8%, 0.5))",
        }}
      />
    </motion.div>
  );
}
