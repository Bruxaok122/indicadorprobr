import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useOnboardingGuide } from "@/hooks/useOnboardingGuide";
import { useAuthContext } from "@/contexts/AuthContext";
import { ONBOARDING_ID, operatorTourSteps } from "./onboardingContent";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

export function OnboardingGuide() {
  const { isAdmin } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, currentStep, nextStep, prevStep, dismiss } =
    useOnboardingGuide(ONBOARDING_ID);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    top: number;
    left: number;
    arrowSide: "top" | "bottom" | "left" | "right";
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [waitingForElement, setWaitingForElement] = useState(false);

  // Filter steps based on available nav items (check if nav elements exist)
  const [availableSteps, setAvailableSteps] = useState(operatorTourSteps);

  useEffect(() => {
    if (!isOpen) return;
    // After a small delay, check which nav items exist and filter steps
    const timer = setTimeout(() => {
      const hasDisparos = !!document.querySelector('[data-onboarding="nav-disparos"]');
      const hasNumeros = !!document.querySelector('[data-onboarding="nav-numeros"]');

      const filtered = operatorTourSteps.filter((step) => {
        // Skip dispatch-related steps if no dispatch access
        if (!hasDisparos && (step.target === "nav-disparos" || step.route === "/disparos")) {
          return false;
        }
        // Skip number-related steps if no number access
        if (!hasNumeros && (step.target === "nav-numeros" || step.route === "/whatsapp-api")) {
          return false;
        }
        return true;
      });
      setAvailableSteps(filtered);
    }, 800);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const steps = availableSteps;
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const totalSteps = steps.length;

  // Navigate to the step's route if needed
  useEffect(() => {
    if (!isOpen || !step?.route) return;
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [isOpen, currentStep, step?.route, location.pathname, navigate]);

  // Find and measure the target element, with retry for route transitions
  const measureTarget = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null);
      setTooltipPos(null);
      setWaitingForElement(false);
      return;
    }
    const el = document.querySelector(`[data-onboarding="${step.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      // Check if element is actually visible (not zero-size)
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
        setWaitingForElement(false);
        return;
      }
    }
    setTargetRect(null);
    setWaitingForElement(true);
  }, [step]);

  // Position tooltip relative to target
  useEffect(() => {
    if (!targetRect || !tooltipRef.current) {
      if (!step?.target) setTooltipPos(null);
      return;
    }

    const tooltip = tooltipRef.current;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    const padding = 16;
    const gap = 20;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;
    let arrowSide: "top" | "bottom" | "left" | "right" = "top";

    if (targetRect.bottom + gap + th + padding < vh) {
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      arrowSide = "top";
    } else if (targetRect.top - gap - th - padding > 0) {
      top = targetRect.top - gap - th;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      arrowSide = "bottom";
    } else if (targetRect.right + gap + tw + padding < vw) {
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.right + gap;
      arrowSide = "left";
    } else {
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.left - gap - tw;
      arrowSide = "right";
    }

    left = Math.max(padding, Math.min(left, vw - tw - padding));
    top = Math.max(padding, Math.min(top, vh - th - padding));

    setTooltipPos({ top, left, arrowSide });
  }, [targetRect, step]);

  // Re-measure on step change, resize, scroll, and retry if waiting
  useEffect(() => {
    if (!isOpen) return;

    // Initial delay for route transition / DOM settling
    const initialDelay = step?.route && location.pathname !== step.route ? 600 : 350;
    const timer = setTimeout(measureTarget, initialDelay);

    // Retry interval when element not found (e.g. page still loading)
    let retryInterval: ReturnType<typeof setInterval> | null = null;
    if (waitingForElement) {
      retryInterval = setInterval(measureTarget, 300);
    }

    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    return () => {
      clearTimeout(timer);
      if (retryInterval) clearInterval(retryInterval);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [isOpen, currentStep, measureTarget, waitingForElement, step?.route, location.pathname]);

  if (isAdmin || !isOpen || !step) return null;

  const overlayContent = (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }}>
      {/* Dark overlay with cutout */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          <mask id="onboarding-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#onboarding-mask)"
        />
      </svg>

      {/* Highlight border pulse around target */}
      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-primary animate-pulse pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow:
              "0 0 20px hsl(var(--primary) / 0.4), inset 0 0 20px hsl(var(--primary) / 0.1)",
          }}
        />
      )}

      {/* Animated hand pointer */}
      {targetRect && (
        <div
          className="absolute pointer-events-none z-[10001]"
          style={{
            top: targetRect.top + targetRect.height / 2 - 4,
            left: targetRect.left + targetRect.width / 2 + 10,
            animation: "hand-point 1.5s ease-in-out infinite",
          }}
        >
          <span
            className="text-3xl drop-shadow-lg"
            style={{
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
            }}
          >
            👆
          </span>
        </div>
      )}

      {/* Click-through area over target */}
      {targetRect && (
        <div
          className="absolute cursor-pointer"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            e.stopPropagation();
            nextStep(totalSteps);
          }}
        />
      )}

      {/* Background overlay click — does nothing (prevents interaction) */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: "auto", zIndex: -1 }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute z-[10002] w-[340px] max-w-[calc(100vw-32px)]",
          "bg-card border border-border rounded-2xl shadow-2xl",
          "animate-scale-in"
        )}
        style={{
          top: tooltipPos?.top ?? (targetRect ? undefined : "50%"),
          left: tooltipPos?.left ?? (targetRect ? undefined : "50%"),
          ...(!targetRect &&
            !tooltipPos && {
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }),
          pointerEvents: "auto",
        }}
      >
        {/* Step counter header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{step.icon || "📌"}</span>
            <span className="text-xs font-medium text-muted-foreground">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
          {/* Progress dots — show groups */}
          <div className="flex gap-0.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentStep
                    ? "w-4 bg-primary"
                    : i < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted-foreground/20"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-2.5">
          <h3 className="font-bold text-foreground text-sm mb-1">
            {step.title}
          </h3>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className="text-muted-foreground text-xs h-8 px-2"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Pular Tour
          </Button>
          <div className="flex gap-1.5">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={prevStep}
                className="h-8 px-3 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                Voltar
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => nextStep(totalSteps)}
              className="h-8 px-3 text-xs"
            >
              {isLast ? "✅ Entendi!" : "Próximo"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}
