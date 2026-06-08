'use client'

import { PersonImage } from './PersonImage'
import { Card } from './Card'
import { Button } from './Button'
import { CheckCircle, X, ArrowRight, Calendar, Cake, Sparkles } from 'lucide-react'

interface ResultOverlayProps {
    isVisible: boolean
    isCorrect: boolean
    personName: string
    correctAnswer: any
    userAnswer: any
    scoreAwarded: number
    onNext: () => void
    onClose?: () => void
    feedbackText: string
    mode?: 'age-guess' | 'whos-older' | 'astrology' | 'daily'
}

export const ResultOverlay = ({
    isVisible,
    isCorrect,
    personName,
    correctAnswer,
    userAnswer,
    scoreAwarded,
    onNext,
    onClose,
    feedbackText,
    mode = 'age-guess'
}: ResultOverlayProps) => {
    if (!isVisible) return null

    const formatBirthDate = (birthDateString: string) => {
        try {
            const date = new Date(birthDateString)
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        } catch {
            return birthDateString
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
            />

            {/* Result Panel */}
            <div className="relative w-full max-w-md mx-4 mb-8 animate-fade-in">
                <Card
                    className={`p-6 space-y-4 ${
                        isCorrect
                            ? 'border-green-500/30 bg-green-500/5'
                            : 'border-red-500/30 bg-red-500/5'
                    }`}
                >
                    {/* Close Button */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-text-muted active:opacity-80"
                        >
                            <X size={20} />
                        </button>
                    )}

                    {/* Result Header */}
                    <div className="text-center space-y-3">
                        <div className="flex justify-center">
                            {isCorrect ? (
                                <CheckCircle size={32} className="text-green-400" fill="currentColor" />
                            ) : (
                                <X size={32} className="text-red-400" />
                            )}
                        </div>

                        <h3 className={`text-xl font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            {isCorrect ? 'Correct!' : 'Not quite!'}
                        </h3>

                        {scoreAwarded > 0 && (
                            <div className="text-sm text-text-muted">
                                +{scoreAwarded} points
                            </div>
                        )}
                    </div>

                    {/* Person Info */}
                    <div className="flex items-center gap-4 p-4 bg-surface rounded-sharp">
                        <PersonImage name={personName} size="md" />
                        <div className="flex-1 space-y-1">
                            <h4 className="font-semibold text-text-primary">{personName}</h4>

                            {mode === 'age-guess' && (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-text-muted">
                                        <Cake size={14} />
                                        <span>Age {correctAnswer.age}</span>
                                    </div>
                                    {correctAnswer.birth_date && (
                                        <div className="flex items-center gap-2 text-xs text-text-muted">
                                            <Calendar size={12} />
                                            <span>{formatBirthDate(correctAnswer.birth_date)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {mode === 'astrology' && (
                                <div className="flex items-center gap-2 text-sm text-text-muted">
                                    <Sparkles size={14} />
                                    <span>{correctAnswer.sign}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Feedback Text */}
                    <div className="p-3 bg-surface rounded-sharp">
                        <p className="text-sm text-text-muted text-center">
                            {feedbackText}
                        </p>
                    </div>

                    {/* Fun Fact */}
                    {correctAnswer.fun_fact && (
                        <div className="p-3 bg-primary/5 rounded-sharp border border-primary/20">
                            <p className="text-xs text-text-muted">
                                <strong>Fun fact:</strong> {correctAnswer.fun_fact}
                            </p>
                        </div>
                    )}

                    {/* Next Button */}
                    <Button onClick={onNext} className="w-full">
                        Continue <ArrowRight size={16} className="ml-2" />
                    </Button>
                </Card>
            </div>
        </div>
    )
}
