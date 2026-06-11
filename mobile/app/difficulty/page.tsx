'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { useDifficultyStore, DifficultyMode, DifficultyLevel } from '@/store/useDifficultyStore'

const LEVELS: { id: DifficultyLevel; label: string; desc: string }[] = [
    { id: 'easy',   label: 'Easy',   desc: 'Well-known names, wider age options' },
    { id: 'medium', label: 'Medium', desc: 'Moderately famous, tighter options'  },
    { id: 'hard',   label: 'Hard',   desc: 'Obscure picks, answers within 1 year' },
]

export default function DifficultyPage() {
    const router = useRouter()
    const { mode: storedMode, level: storedLevel, setMode, setLevel } = useDifficultyStore()

    const [draftMode, setDraftMode]   = useState<DifficultyMode>(storedMode)
    const [draftLevel, setDraftLevel] = useState<DifficultyLevel>(storedLevel)

    const handleConfirm = () => {
        setMode(draftMode)
        setLevel(draftLevel)
        router.back()
    }

    return (
        <div className="min-h-dvh bg-canvas flex flex-col px-5 pt-10">
            {/* Header */}
            <div className="mb-6">
                <h1 className="font-serif text-lg text-text-primary tracking-tight">Difficulty</h1>
                <p className="font-sans text-[9px] text-text-muted tracking-widest uppercase mt-0.5">
                    How do you want to be challenged?
                </p>
            </div>

            {/* Mode buttons */}
            <div className="flex flex-col gap-3">

                {/* Option A — Fixed Level */}
                <div
                    className={
                        "rounded-sharp border overflow-hidden transition-colors " +
                        (draftMode === "fixed"
                            ? "border-primary bg-primary/5"
                            : "border-border-subtle bg-surface-raised")
                    }
                >
                    <button
                        onClick={() => setDraftMode("fixed")}
                        className="w-full flex items-center justify-between px-5 py-4"
                    >
                        <div className="text-left">
                            <div className="font-serif text-base text-text-primary">Fixed Level</div>
                            <div className="font-sans text-[9px] text-text-muted tracking-wide mt-0.5">
                                Every question matches your chosen difficulty
                            </div>
                        </div>
                        <div className={
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors " +
                            (draftMode === "fixed" ? "border-primary bg-primary" : "border-border-subtle")
                        }>
                            {draftMode === "fixed" && <Check size={10} strokeWidth={3} className="text-white" />}
                        </div>
                    </button>

                    <AnimatePresence initial={false}>
                        {draftMode === "fixed" && (
                            <motion.div
                                key="levels"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <div className="border-t border-primary/10 px-5 pb-4 pt-3 flex flex-col gap-2">
                                    {LEVELS.map((lvl) => (
                                        <button
                                            key={lvl.id}
                                            onClick={() => setDraftLevel(lvl.id)}
                                            className={
                                                "flex items-center justify-between px-4 py-3 rounded-sharp border transition-all " +
                                                (draftLevel === lvl.id
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border-subtle hover:border-gold/30")
                                            }
                                        >
                                            <div className="text-left">
                                                <div className={
                                                    "font-sans text-[11px] tracking-wide " +
                                                    (draftLevel === lvl.id ? "text-primary" : "text-text-primary")
                                                }>
                                                    {lvl.label}
                                                </div>
                                                <div className="font-sans text-[9px] text-text-muted mt-0.5">
                                                    {lvl.desc}
                                                </div>
                                            </div>
                                            {draftLevel === lvl.id && (
                                                <Check size={12} strokeWidth={3} className="text-primary flex-shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Option B — Escalating */}
                <button
                    onClick={() => setDraftMode("escalating")}
                    className={
                        "w-full flex items-center justify-between px-5 py-4 rounded-sharp border transition-colors " +
                        (draftMode === "escalating"
                            ? "border-primary bg-primary/5"
                            : "border-border-subtle bg-surface-raised")
                    }
                >
                    <div className="text-left">
                        <div className="font-serif text-base text-text-primary">Escalating</div>
                        <div className="font-sans text-[9px] text-text-muted tracking-wide mt-0.5">
                            Starts easy — builds to hard by the final questions
                        </div>
                    </div>
                    <div className={
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors " +
                        (draftMode === "escalating" ? "border-primary bg-primary" : "border-border-subtle")
                    }>
                        {draftMode === "escalating" && <Check size={10} strokeWidth={3} className="text-white" />}
                    </div>
                </button>
            </div>

            {/* Bottom nav */}
            <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 flex items-center justify-between bg-gradient-to-t from-canvas to-transparent">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 font-sans text-[10px] tracking-widest uppercase text-text-muted hover:text-text-primary transition-colors"
                >
                    <ArrowLeft size={14} />
                    Back
                </button>
                <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 bg-primary text-white font-sans text-[10px] tracking-widest uppercase px-6 py-3 rounded-sharp active:opacity-80 transition-all shadow-lg shadow-black/40"
                >
                    Confirm
                    <ChevronRight size={12} />
                </button>
            </div>
        </div>
    )
}
