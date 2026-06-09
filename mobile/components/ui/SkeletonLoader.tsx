'use client'

interface SkeletonProps {
    className?: string
    width?: string | number
    height?: string | number
}

export const Skeleton = ({ className = '', width, height }: SkeletonProps) => {
    return (
        <div
            className={`skeleton rounded-sharp ${className}`}
            style={{ width, height }}
        />
    )
}

export const GameLoadingSkeleton = () => (
    <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-sans text-[10px] text-text-muted tracking-[0.3em] uppercase">Loading</p>
    </div>
)
