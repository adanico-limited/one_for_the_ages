import { create } from "zustand"
import { persist } from "zustand/middleware"

export type DifficultyMode = "fixed" | "escalating"
export type DifficultyLevel = "easy" | "medium" | "hard"

interface DifficultyStore {
    mode: DifficultyMode
    level: DifficultyLevel
    setMode: (mode: DifficultyMode) => void
    setLevel: (level: DifficultyLevel) => void
}

export const useDifficultyStore = create<DifficultyStore>()(
    persist(
        (set) => ({
            mode: "fixed",
            level: "easy",
            setMode: (mode) => set({ mode }),
            setLevel: (level) => set({ level }),
        }),
        { name: "ofta-difficulty" }
    )
)

export function getDifficultyParam(mode: DifficultyMode, level: DifficultyLevel): string {
    return mode === "escalating" ? "escalating" : level
}
