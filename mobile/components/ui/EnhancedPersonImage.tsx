'use client'

import { useState, useEffect } from 'react'
import { getCachedPersonImage, preloadImage } from '@/lib/image-service'
import { ImagePlaceholder } from './ImagePlaceholder'
import { logger } from '@/lib/logger'

interface EnhancedPersonImageProps {
    name: string
    size?: 'hero' | 'card' | 'thumbnail' | 'avatar'
    className?: string
    quality?: 'high' | 'medium' | 'low'
    showFallback?: boolean
    aspectRatio?: 'portrait' | 'square' | 'landscape'
    children?: React.ReactNode // For overlays
}

const sizeClasses = {
    hero: 'w-full h-[500px]',
    card: 'w-48 h-60',
    thumbnail: 'w-20 h-24',
    avatar: 'w-16 h-16'
}

const aspectRatioClasses = {
    portrait: 'aspect-[4/5]',
    square: 'aspect-square',
    landscape: 'aspect-[16/9]'
}

// Generate consistent color based on name for fallback
const getColorFromName = (name: string): string => {
    const colors = [
        'from-blue-500 to-cyan-500',
        'from-purple-500 to-pink-500',
        'from-green-500 to-emerald-500',
        'from-orange-500 to-red-500',
        'from-indigo-500 to-purple-500',
        'from-pink-500 to-rose-500',
        'from-teal-500 to-blue-500',
        'from-yellow-500 to-orange-500'
    ]

    const hash = name.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
    }, 0)

    return colors[Math.abs(hash) % colors.length]
}

// Extract initials from full name
const getInitials = (name: string): string => {
    return name
        .split(' ')
        .map(word => word.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

export const EnhancedPersonImage = ({
    name,
    size = 'card',
    className = '',
    quality = 'medium',
    showFallback = true,
    aspectRatio = 'portrait',
    children
}: EnhancedPersonImageProps) => {
    const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading')
    const [imageUrl, setImageUrl] = useState<string | null>(null)

    const initials = getInitials(name)
    const gradientClass = getColorFromName(name)

    useEffect(() => {
        const loadImage = async () => {
            try {
                const personImage = getCachedPersonImage(name, size, quality)
                await preloadImage(personImage.url)
                setImageUrl(personImage.url)
                setImageState('loaded')
            } catch (error) {
                logger.warn(`Failed to load image for ${name}:`, error)
                setImageState('error')
            }
        }

        loadImage()
    }, [name, size, quality])

    const baseClasses = `
        relative overflow-hidden rounded-2xl
        ${aspectRatio ? aspectRatioClasses[aspectRatio] : sizeClasses[size]}
        ${className}
    `

    // Loading state with shimmer
    if (imageState === 'loading') {
        return (
            <div className={baseClasses}>
                <ImagePlaceholder
                    variant="shimmer"
                    className="w-full h-full"
                >
                    <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin opacity-40" />
                        <span className="text-text-muted text-caption">Loading...</span>
                    </div>
                </ImagePlaceholder>
                {children && (
                    <div className="absolute inset-0">
                        {children}
                    </div>
                )}
            </div>
        )
    }

    // Successfully loaded image
    if (imageState === 'loaded' && imageUrl) {
        return (
            <div className={baseClasses}>
                <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    style={{
                        filter: 'brightness(0.9) contrast(1.1) saturate(1.1)'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                {children && (
                    <div className="absolute inset-0">
                        {children}
                    </div>
                )}
            </div>
        )
    }

    // Error state - show styled fallback or avatar
    if (showFallback) {
        return (
            <div className={baseClasses}>
                <div
                    className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-center justify-center`}
                    style={{
                        backgroundImage: `
                            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 50%),
                            radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)
                        `
                    }}
                >
                    <div className="text-center">
                        {size === 'hero' || size === 'card' ? (
                            <>
                                <div className="text-4xl font-bold text-white mb-2 text-shadow-sm">
                                    {initials}
                                </div>
                                <div className="text-caption text-white/80 text-shadow-sm">
                                    {name}
                                </div>
                            </>
                        ) : (
                            <div className="text-lg font-bold text-white text-shadow-sm">
                                {initials}
                            </div>
                        )}
                    </div>

                    {/* Decorative overlay for hero size */}
                    {size === 'hero' && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                    )}
                </div>
                {children && (
                    <div className="absolute inset-0">
                        {children}
                    </div>
                )}
            </div>
        )
    }

    // No fallback - return empty state
    return (
        <div className={baseClasses}>
            <ImagePlaceholder
                variant="gradient"
                className="w-full h-full"
            >
                <span className="text-text-muted text-caption">No image</span>
            </ImagePlaceholder>
            {children && (
                <div className="absolute inset-0">
                    {children}
                </div>
            )}
        </div>
    )
}