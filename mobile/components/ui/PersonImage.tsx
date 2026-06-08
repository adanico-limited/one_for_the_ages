'use client'

import { useState } from 'react'

interface PersonImageProps {
    name: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    rounded?: 'full' | 'sharp'
    className?: string
    imageUrl?: string | null
}

const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-lg',
    lg: 'w-24 h-24 text-2xl',
    xl: 'w-full aspect-square text-6xl',
    full: 'w-full h-full text-6xl'
}


export const PersonImage = ({
    name,
    size = 'lg',
    rounded = 'full',
    className = '',
    imageUrl
}: PersonImageProps) => {
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)

    const borderRadius = rounded === 'full' ? 'rounded-full' : 'rounded-sharp'

    // If image URL provided and loaded successfully
    if (imageUrl && imageLoaded && !imageError) {
        return (
            <div className={`${sizeClasses[size]} ${borderRadius} overflow-hidden border-2 border-border-subtle ${className}`}>
                <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                />
            </div>
        )
    }

    // Blank placeholder
    return (
        <div
            className={`${sizeClasses[size]} ${borderRadius} bg-surface border border-border-subtle ${className}`}
        >
            {imageUrl && !imageLoaded && !imageError && (
                <img
                    src={imageUrl}
                    alt={name}
                    className="hidden"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                />
            )}
        </div>
    )
}
