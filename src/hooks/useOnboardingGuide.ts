import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "juriszap_onboarding_seen";

function getSeenGuides(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function markGuideSeen(guideId: string) {
  const seen = getSeenGuides();
  if (!seen.includes(guideId)) {
    seen.push(guideId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  }
}

export function useOnboardingGuide(guideId: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const seen = getSeenGuides();
    if (!seen.includes(guideId)) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [guideId]);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    setCurrentStep(0);
    markGuideSeen(guideId);
  }, [guideId]);

  const nextStep = useCallback((totalSteps: number) => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [currentStep, dismiss]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const reopen = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  return { isOpen, currentStep, nextStep, prevStep, dismiss, reopen };
}

export function resetAllGuides() {
  localStorage.removeItem(STORAGE_KEY);
}

export function resetGuide(guideId: string) {
  const seen = getSeenGuides().filter((id) => id !== guideId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
}
