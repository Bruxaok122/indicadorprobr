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
  startedAt: string;
  phoneName?: string;
}

interface DispatchControls {
  isPaused: boolean;
  isCancelled: boolean;
}

interface DispatchContextType {
  activeDispatches: ActiveDispatch[];
  addDispatch: (dispatch: ActiveDispatch) => void;
  updateDispatch: (id: string, updates: Partial<ActiveDispatch>) => void;
  removeDispatch: (id: string) => void;
  pauseDispatch: (id: string) => void;
  cancelDispatch: (id: string) => void;
  getControls: (id: string) => DispatchControls | undefined;
  setControls: (id: string, controls: DispatchControls) => void;
  clearControls: (id: string) => void;
}

const DispatchContext = createContext<DispatchContextType | null>(null);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const [activeDispatches, setActiveDispatches] = useState<ActiveDispatch[]>([]);
  const controlsRef = useRef<Record<string, DispatchControls>>({});

  const addDispatch = useCallback((dispatch: ActiveDispatch) => {
    controlsRef.current[dispatch.id] = { isPaused: false, isCancelled: false };
    setActiveDispatches((prev) => [dispatch, ...prev]);
  }, []);

  const updateDispatch = useCallback((id: string, updates: Partial<ActiveDispatch>) => {
    setActiveDispatches((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }, []);

  const removeDispatch = useCallback((id: string) => {
    setActiveDispatches((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const pauseDispatch = useCallback((id: string) => {
    const ctrl = controlsRef.current[id];
    if (!ctrl) return;
    ctrl.isPaused = !ctrl.isPaused;
    setActiveDispatches((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isPaused: ctrl.isPaused } : d))
    );
  }, []);

  const cancelDispatch = useCallback((id: string) => {
    const ctrl = controlsRef.current[id];
    if (!ctrl) return;
    ctrl.isCancelled = true;
    ctrl.isPaused = false;
    setActiveDispatches((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isCancelled: true, isPaused: false } : d))
    );
  }, []);

  const getControls = useCallback((id: string) => controlsRef.current[id], []);
  const setControls = useCallback((id: string, controls: DispatchControls) => {
    controlsRef.current[id] = controls;
  }, []);
  const clearControls = useCallback((id: string) => {
    delete controlsRef.current[id];
  }, []);

  return (
    <DispatchContext.Provider
      value={{
        activeDispatches,
        addDispatch,
        updateDispatch,
        removeDispatch,
        pauseDispatch,
        cancelDispatch,
        getControls,
        setControls,
        clearControls,
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
