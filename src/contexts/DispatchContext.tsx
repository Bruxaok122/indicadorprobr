import { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  loadingFromDb: boolean;
}

const DispatchContext = createContext<DispatchContextType | null>(null);

/** Persist a dispatch record to the database */
async function upsertDispatchToDb(dispatch: ActiveDispatch) {
  try {
    await supabase.from("active_dispatches").upsert({
      id: dispatch.id,
      operator_name: dispatch.operatorName,
      operator_id: dispatch.operatorId,
      template_name: dispatch.templateName,
      list_name: dispatch.listName,
      mode: dispatch.mode,
      total: dispatch.total,
      sent: dispatch.sent,
      failed: dispatch.failed,
      current: dispatch.current,
      is_paused: dispatch.isPaused,
      is_cancelled: dispatch.isCancelled,
      is_finished: dispatch.isFinished,
      errors: dispatch.errors as any,
      updated_at: new Date().toISOString(),
    } as any);
  } catch (e) {
    console.error("Failed to persist dispatch to DB:", e);
  }
}

async function deleteDispatchFromDb(dispatchId: string) {
  try {
    await supabase.from("active_dispatches").delete().eq("id", dispatchId);
  } catch (e) {
    console.error("Failed to delete dispatch from DB:", e);
  }
}

function mapDbRowToDispatch(row: any): ActiveDispatch {
  return {
    id: row.id,
    operatorName: row.operator_name,
    operatorId: row.operator_id,
    templateName: row.template_name,
    listName: row.list_name,
    mode: row.mode as DispatchMode,
    total: row.total,
    sent: row.sent,
    failed: row.failed,
    current: row.current,
    isPaused: row.is_paused,
    isCancelled: row.is_cancelled,
    isFinished: row.is_finished,
    errors: Array.isArray(row.errors) ? row.errors : [],
  };
}

export function DispatchProvider({ children }: { children: ReactNode }) {
  const [activeDispatches, setActiveDispatches] = useState<ActiveDispatch[]>([]);
  const [loadingFromDb, setLoadingFromDb] = useState(true);
  const dispatchControlsRef = useRef<Record<string, DispatchControls>>({});

  // Load persisted dispatches from DB on mount
  useEffect(() => {
    async function loadDispatches() {
      try {
        const { data } = await supabase
          .from("active_dispatches")
          .select("*")
          .order("created_at", { ascending: false });

        if (data && data.length > 0) {
          const mapped = (data as any[]).map(mapDbRowToDispatch);
          setActiveDispatches(mapped);
        }
      } catch (e) {
        console.error("Failed to load dispatches from DB:", e);
      } finally {
        setLoadingFromDb(false);
      }
    }
    loadDispatches();

    // Poll DB every 5s to sync dispatches updated by the running loop
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("active_dispatches")
          .select("*")
          .order("created_at", { ascending: false });

        if (data) {
          const mapped = (data as any[]).map(mapDbRowToDispatch);
          setActiveDispatches((prev) => {
            // Merge: keep local state for dispatches owned by this browser (have controls),
            // but update from DB for dispatches we don't control locally
            const localControlledIds = new Set(Object.keys(dispatchControlsRef.current));
            const merged = mapped.map((dbDispatch) => {
              if (localControlledIds.has(dbDispatch.id)) {
                // This dispatch is being run by this browser - keep local state
                const local = prev.find((p) => p.id === dbDispatch.id);
                return local || dbDispatch;
              }
              return dbDispatch;
            });
            return merged;
          });
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const updateDispatch = useCallback((dispatchId: string, updates: Partial<ActiveDispatch>) => {
    setActiveDispatches((prev) => {
      const updated = prev.map((d) => (d.id === dispatchId ? { ...d, ...updates } : d));
      // Persist the updated dispatch to DB
      const dispatch = updated.find((d) => d.id === dispatchId);
      if (dispatch) upsertDispatchToDb(dispatch);
      return updated;
    });
  }, []);

  const addDispatch = useCallback((dispatch: ActiveDispatch) => {
    setActiveDispatches((prev) => [dispatch, ...prev]);
    upsertDispatchToDb(dispatch);
  }, []);

  const dismissDispatch = useCallback((dispatchId: string) => {
    setActiveDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
    deleteDispatchFromDb(dispatchId);
  }, []);

  const handlePause = useCallback((dispatchId: string) => {
    const ctrl = dispatchControlsRef.current[dispatchId];
    if (!ctrl) return;
    ctrl.isPaused = !ctrl.isPaused;
    setActiveDispatches((prev) => {
      const updated = prev.map((d) => (d.id === dispatchId ? { ...d, isPaused: ctrl.isPaused } : d));
      const dispatch = updated.find((d) => d.id === dispatchId);
      if (dispatch) upsertDispatchToDb(dispatch);
      return updated;
    });
  }, []);

  const handleCancel = useCallback((dispatchId: string) => {
    const ctrl = dispatchControlsRef.current[dispatchId];
    if (!ctrl) return;
    ctrl.isCancelled = true;
    ctrl.isPaused = false;
    setActiveDispatches((prev) => {
      const updated = prev.map((d) => (d.id === dispatchId ? { ...d, isCancelled: true, isPaused: false } : d));
      const dispatch = updated.find((d) => d.id === dispatchId);
      if (dispatch) upsertDispatchToDb(dispatch);
      return updated;
    });
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
        loadingFromDb,
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
