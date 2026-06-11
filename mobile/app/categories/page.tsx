'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ArrowLeft, Check } from 'lucide-react'
import { CATEGORIES, getCategoryLabel } from '@/lib/categories'
import { useCategoryStore } from '@/store/useCategoryStore'

export default function CategoriesPage() {
    const router = useRouter()
    const { selected, toggle, clear } = useCategoryStore()
    const [expanded, setExpanded] = useState<string[]>(['sports', 'tv_film', 'music'])
    const [draft, setDraft] = useState<string[]>(selected)

    const toggleDraft = (id: string) => {
        setDraft((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        )
    }

    const toggleSection = (id: string) => {
        setExpanded((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        )
    }

    const handleConfirm = () => {
        // Apply draft to the real store
        clear()
        draft.forEach((id) => {
            if (!selected.includes(id)) toggle(id)
        })
        // Sync cleanly: set store directly
        useCategoryStore.setState({ selected: draft })
        router.back()
    }

    const label = getCategoryLabel(draft)
    const confirmLabel = draft.length === 0 ? 'Play All' : `Confirm  •  ${label}`

    return (
        <div className="min-h-dvh bg-canvas flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-10 pb-4">
                <button
                    onClick={() => router.back()}
                    className="text-text-muted hover:text-text-primary transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="font-serif text-lg text-text-primary tracking-tight">Categories</h1>
                    <p className="font-sans text-[9px] text-text-muted tracking-widest uppercase mt-0.5">
                        Select what you want to be quizzed on
                    </p>
                </div>
            </div>

            {/* Clear all */}
            {draft.length > 0 && (
                <div className="px-5 pb-2 flex justify-end">
                    <button
                        onClick={() => setDraft([])}
                        className="font-sans text-[9px] text-text-muted tracking-widest uppercase hover:text-primary transition-colors"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Category sections */}
            <div className="flex-1 px-5 pb-32 flex flex-col gap-3 overflow-y-auto">
                {CATEGORIES.map((cat) => {
                    const isOpen = expanded.includes(cat.id)
                    const selectedInSection = cat.subcategories.filter(
                        (s) => s.available && draft.includes(s.id)
                    ).length
                    const availableInSection = cat.subcategories.filter((s) => s.available).length

                    return (
                        <div key={cat.id} className="bg-surface-raised border border-gold/10 rounded-sharp overflow-hidden">
                            {/* Section header */}
                            <button
                                onClick={() => toggleSection(cat.id)}
                                className="w-full flex items-center justify-between px-5 py-4"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-serif text-base text-text-primary">
                                        {cat.label}
                                    </span>
                                    {selectedInSection > 0 && (
                                        <span className="font-sans text-[8px] tracking-widest uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                                            {selectedInSection}/{availableInSection}
                                        </span>
                                    )}
                                </div>
                                <motion.div
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ChevronDown size={16} className="text-text-muted" />
                                </motion.div>
                            </button>

                            {/* Subcategories */}
                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        key="content"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-gold/5 pt-3">
                                            {cat.subcategories.map((sub) => {
                                                const isSelected = draft.includes(sub.id)
                                                return (
                                                    <button
                                                        key={sub.id}
                                                        onClick={() => sub.available && toggleDraft(sub.id)}
                                                        disabled={!sub.available}
                                                        className={
                                                            "flex items-center gap-1.5 font-sans text-[10px] tracking-wide px-3 py-2 rounded-sharp border transition-all " +
                                                            (sub.available
                                                                ? isSelected
                                                                    ? "bg-primary/15 border-primary text-primary"
                                                                    : "border-border-subtle text-text-muted hover:border-gold/30 hover:text-text-primary"
                                                                : "border-border-subtle/30 text-text-muted/30 cursor-not-allowed")
                                                        }
                                                    >
                                                        {isSelected && <Check size={10} strokeWidth={3} />}
                                                        {sub.label}
                                                        {!sub.available && (
                                                            <span className="text-[8px] uppercase tracking-widest text-text-muted/30 ml-1">
                                                                Soon
                                                            </span>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>

            {/* Fixed confirm button */}
            <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-gradient-to-t from-canvas to-transparent">
                <button
                    onClick={handleConfirm}
                    className="w-full bg-primary text-white font-sans text-[11px] tracking-widest uppercase py-4 rounded-sharp active:opacity-80 transition-all shadow-lg shadow-black/40"
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    )
}
