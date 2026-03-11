import { useOnboardingGuide } from "@/hooks/useOnboardingGuide";
import { GuideContent } from "./onboardingContent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingGuideProps {
  guide: GuideContent;
}

export function OnboardingGuide({ guide }: OnboardingGuideProps) {
  const { isOpen, currentStep, nextStep, prevStep, dismiss } =
    useOnboardingGuide(guide.id);

  const steps = guide.steps;
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLast = currentStep === steps.length - 1;

  if (!isOpen || !step) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary/90 to-primary p-5 text-primary-foreground">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-primary-foreground/80 text-xs font-medium">
              <BookOpen className="h-3.5 w-3.5" />
              Guia de Instrução
            </div>
            <DialogTitle className="text-primary-foreground text-lg">
              {guide.title}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/70 text-xs">
              Passo {currentStep + 1} de {steps.length}
            </DialogDescription>
          </DialogHeader>
          <Progress
            value={progress}
            className="mt-3 h-1.5 bg-primary-foreground/20 [&>div]:bg-primary-foreground/80"
          />
        </div>

        {/* Step content */}
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0 mt-0.5">{step.icon || "📌"}</span>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-foreground text-sm">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 pt-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentStep
                    ? "w-6 bg-primary"
                    : i < currentStep
                      ? "w-1.5 bg-primary/40"
                      : "w-1.5 bg-muted-foreground/20"
                )}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 pt-0 flex-row gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className="text-muted-foreground text-xs mr-auto"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Pular guia
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={prevStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={() => nextStep(steps.length)}>
              {isLast ? "Concluir" : "Próximo"}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
