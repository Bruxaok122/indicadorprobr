import { useEffect, useState, useCallback, useRef } from "react";
import { useOnboardingGuide } from "@/hooks/useOnboardingGuide";
import { useAuthContext } from "@/contexts/AuthContext";
import { GuideContent } from "./onboardingContent";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface OnboardingGuideProps {
  guide: GuideContent;
}

export function OnboardingGuide({ guide }: OnboardingGuideProps) {
  const { isAdmin } = useAuthContext();
  const { isOpen, currentStep, nextStep, prevStep, dismiss } =
    useOnboardingGuide(guide.id);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; arrowSide: "top" | "bottom" | "left" | "right" } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const steps = guide.steps;
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  // Find and measure the target element
  const measureTarget = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null);
      setTooltipPos(null);
      return;
    }
    const el = document.querySelector(`[data-onboarding="${step.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  // Position tooltip relative to target
  useEffect(() => {
    if (!targetRect || !tooltipRef.current) {
      if (!step?.target) {
        setTooltipPos(null);
      }
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

    // Prefer below target
    if (targetRect.bottom + gap + th + padding < vh) {
      top = targetRect.bottom + gap;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      arrowSide = "top";
    }
    // Try above
    else if (targetRect.top - gap - th - padding > 0) {
      top = targetRect.top - gap - th;
      left = targetRect.left + targetRect.width / 2 - tw / 2;
      arrowSide = "bottom";
    }
    // Try right
    else if (targetRect.right + gap + tw + padding < vw) {
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.right + gap;
      arrowSide = "left";
    }
    // Try left
    else {
      top = targetRect.top + targetRect.height / 2 - th / 2;
      left = targetRect.left - gap - tw;
      arrowSide = "right";
    }

    // Clamp
    left = Math.max(padding, Math.min(left, vw - tw - padding));
    top = Math.max(padding, Math.min(top, vh - th - padding));

    setTooltipPos({ top, left, arrowSide });
  }, [targetRect, step]);

  // Re-measure on step change and resize
  useEffect(() => {
    if (!isOpen) return;
    // Small delay for DOM to settle
    const timer = setTimeout(measureTarget, 300);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [isOpen, currentStep, measureTarget]);

  if (isAdmin || !isOpen || !step) return null;

  const overlayContent = (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }}>
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
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
          x="0" y="0" width="100%" height="100%"
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
            boxShadow: "0 0 20px hsl(var(--primary) / 0.4), inset 0 0 20px hsl(var(--primary) / 0.1)",
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
          <span className="text-3xl drop-shadow-lg" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}>
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
            nextStep(steps.length);
          }}
        />
      )}

      {/* Click overlay to advance or dismiss */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: "auto", zIndex: -1 }}
        onClick={(e) => {
          e.stopPropagation();
          // Only dismiss on overlay click, not on tooltip
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute z-[10002] w-[320px] max-w-[calc(100vw-32px)]",
          "bg-card border border-border rounded-2xl shadow-2xl",
          "animate-scale-in"
        )}
        style={{
          top: tooltipPos?.top ?? (targetRect ? undefined : "50%"),
          left: tooltipPos?.left ?? (targetRect ? undefined : "50%"),
          ...((!targetRect && !tooltipPos) && { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
          pointerEvents: "auto",
        }}
      >
        {/* Step counter header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{step.icon || "📌"}</span>
            <span className="text-xs font-medium text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentStep
                    ? "w-5 bg-primary"
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
          <h3 className="font-bold text-foreground text-sm mb-1">{step.title}</h3>
          <p className="text-muted-foreground text-[13px] leading-relaxed">{step.description}</p>
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
            Pular
          </Button>
          <div className="flex gap-1.5">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={prevStep} className="h-8 px-3 text-xs">
                <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                Voltar
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => nextStep(steps.length)}
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
