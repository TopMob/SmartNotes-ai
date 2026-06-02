import { create } from "zustand";

type AiEngineStatus = "pending" | "analyzing" | "done" | "error";

type AiEngineState = {
  status: AiEngineStatus;
  setStatus: (status: AiEngineStatus) => void;
};

export const useAiEngineStore = create<AiEngineState>((set) => ({
  status: "done",
  setStatus: (status) => set({ status }),
}));
