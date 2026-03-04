import { createContext, useContext, useState, useRef, ReactNode, useCallback } from "react";

export type DispatchMode = "batch" | "individual";

export interface ActiveDispatch {
  id: string;
  operatorName: string;
  operatorId: string;
  templateName: string;
  listName: string;
  mode: DispatchMode;
  total: number;
  sent: number;
  failed: number;
  current: number;
  isPaused: boolean;
  isCancelled: boolean;
  isFinished: boolean;
  errors: string[];
}

interface DispatchControls {
  isPaused: boolean;
  isCancelled: boolean;
}

interface DispatchContextType {
  activeDispatches: ActiveDispatch[];
  setActiveDispatches: React.Dispatch<React.SetStateAction<ActiveDispatch[]>>;
  updateDispatch: (dispatchId: string, updates: Partial<ActiveDispatch>) => void;
  addDispatch: (dispatch: ActiveDispatch) => void;
  dismissDispatch: (dispatchId: string) => void;
  handlePause: (dispatchId: string) => void;
  handleCancel: (dispatchId: string) => void;
  dispatchControlsRef: React.MutableRefObject<Record<string, DispatchControls>>;
  hasActiveDispatch: boolean;
}

const DispatchContext = createContext<DispatchContextType | null>(null);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const [activeDispatches, setActiveDispatches] = useState<ActiveDispatch[]>([]);
  const dispatchControlsRef = useRef<Record<string, DispatchControls>>({});

  const updateDispatch = useCallback((dispatchId: string, updates: Partial<ActiveDispatch>) => {
    setActiveDispatches((prev) => prev.map((d) => (d.id === dispatchId ? { ...d, ...updates } : d)));
  }, []);

  const addDispatch = useCallback((dispatch: ActiveDispatch) => {
    setActiveDispatches((prev) => [dispatch, ...prev]);
  }, []);

  const dismissDispatch = useCallback((dispatchId: string) => {
    setActiveDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
  }, []);

  const handlePause = useCallback((dispatchId: string) => {
    const ctrl = dispatchControlsRef.current[dispatchId];
    if (!ctrl) return;
    ctrl.isPaused = !ctrl.isPaused;
    setActiveDispatches((prev) =>
      prev.map((d) => (d.id === dispatchId ? { ...d, isPaused: ctrl.isPaused } : d))
    );
  }, []);

  const handleCancel = useCallback((dispatchId: string) => {
    const ctrl = dispatchControlsRef.current[dispatchId];
    if (!ctrl) return;
    ctrl.isCancelled = true;
    ctrl.isPaused = false;
    setActiveDispatches((prev) =>
      prev.map((d) => (d.id === dispatchId ? { ...d, isCancelled: true, isPaused: false } : d))
    );
  }, []);

  const hasActiveDispatch = activeDispatches.some((d) => !d.isFinished);

  return (
    <DispatchContext.Provider
      value={{
        activeDispatches,
        setActiveDispatches,
        updateDispatch,
        addDispatch,
        dismissDispatch,
        handlePause,
        handleCancel,
        dispatchControlsRef,
        hasActiveDispatch,
      }}
    >
      {children}
    </DispatchContext.Provider>
  );
}

export function useDispatchContext() {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useDispatchContext must be used within DispatchProvider");
  return ctx;
}
