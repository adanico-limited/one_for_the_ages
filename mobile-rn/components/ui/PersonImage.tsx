import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Image } from 'expo-image'

interface PersonImageProps {
    name: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    imageUrl?: string | null
    style?: ViewStyle
}

const sizes = { sm: 48, md: 64, lg: 96, xl: 280 }

export const PersonImage = ({ name, size = 'lg', imageUrl, style }: PersonImageProps) => {
    const [error, setError] = useState(false)

    useEffect(() => { setError(false) }, [imageUrl])

    const dim = sizes[size]
    const showImage = !!imageUrl && !error

    return (
        <View style={[s.wrap, { width: dim, height: dim, borderRadius: size === 'xl' ? 4 : dim / 2 }, style]}>
            {showImage ? (
                <Image
                    source={{ uri: imageUrl! }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    onError={() => setError(true)}
                    transition={300}
                />
            ) : (
                <Text style={[s.initial, { fontSize: size === 'xl' ? 60 : 24 }]}>
                    {name.charAt(0).toUpperCase()}
                </Text>
            )}
        </View>
    )
}

const s = StyleSheet.create({
    wrap: { backgroundColor: '#1e2040', borderWidth: 1, borderColor: '#2e2c4e', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    initial: { fontFamily: 'PlayfairDisplay_700Bold', color: 'rgba(136,132,168,0.4)' },
})
