/**
 * Image Service for Person Photos
 * Handles image URL generation, caching, and fallback strategies
 */

// For now, using a placeholder service that generates realistic-looking image URLs
// In production, this would connect to your person image database/API

interface PersonImage {
    url: string
    source: 'real' | 'ai-generated' | 'placeholder'
    quality: 'high' | 'medium' | 'low'
}

interface ImageDimensions {
    width: number
    height: number
}

const IMAGE_SIZES = {
    hero: { width: 400, height: 500 },
    card: { width: 200, height: 250 },
    thumbnail: { width: 80, height: 100 },
    avatar: { width: 64, height: 64 }
} as const

type ImageSize = keyof typeof IMAGE_SIZES

/**
 * Generates a person image URL
 * Currently uses placeholder.com, but in production would use your image service
 */
export const getPersonImageUrl = (
    personName: string,
    size: ImageSize = 'card',
    quality: 'high' | 'medium' | 'low' = 'medium'
): PersonImage => {
    const dimensions = IMAGE_SIZES[size]

    // Simulate a realistic fallback strategy
    // In production, you'd check your database first, then AI-generated, then placeholder

    // For demo purposes, generate different URLs based on person name
    const nameHash = personName.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
    }, 0)

    // Simulate having real photos for some celebrities
    const hasRealPhoto = Math.abs(nameHash) % 3 === 0

    if (hasRealPhoto) {
        // In production: return real person photo URL
        return {
            url: `https://picsum.photos/${dimensions.width}/${dimensions.height}?random=${Math.abs(nameHash)}`,
            source: 'real',
            quality
        }
    }

    // Simulate AI-generated photos for others
    const hasAiPhoto = Math.abs(nameHash) % 2 === 0

    if (hasAiPhoto) {
        // In production: return AI-generated photo URL
        return {
            url: `https://picsum.photos/${dimensions.width}/${dimensions.height}?random=${Math.abs(nameHash) + 1000}&grayscale`,
            source: 'ai-generated',
            quality
        }
    }

    // Fallback to placeholder
    return {
        url: `https://via.placeholder.com/${dimensions.width}x${dimensions.height}/6366f1/ffffff?text=${encodeURIComponent(personName)}`,
        source: 'placeholder',
        quality: 'low'
    }
}

/**
 * Preloads an image and returns a promise
 */
export const preloadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
    })
}

/**
 * Cache for loaded images
 */
const imageCache = new Map<string, PersonImage>()

/**
 * Gets cached image or fetches new one
 */
export const getCachedPersonImage = (
    personName: string,
    size: ImageSize = 'card',
    quality: 'high' | 'medium' | 'low' = 'medium'
): PersonImage => {
    const cacheKey = `${personName}-${size}-${quality}`

    if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey)!
    }

    const image = getPersonImageUrl(personName, size, quality)
    imageCache.set(cacheKey, image)

    return image
}

/**
 * Clears image cache
 */
export const clearImageCache = () => {
    imageCache.clear()
}