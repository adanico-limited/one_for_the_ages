import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { zustandStorage } from '@/lib/storage'

interface CategoryStore {
    selected: string[]
    toggle: (id: string) => void
    clear: () => void
}

export const useCategoryStore = create<CategoryStore>()(
    persist(
        (set) => ({
            selected: [],
            toggle: (id) =>
                set((state) => ({
                    selected: state.selected.includes(id)
                        ? state.selected.filter((s) => s !== id)
                        : [...state.selected, id],
                })),
            clear: () => set({ selected: [] }),
        }),
        { name: 'ofta-categories', storage: zustandStorage }
    )
)
