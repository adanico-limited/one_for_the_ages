import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Link, usePathname } from 'expo-router'
import { Home, Trophy, User } from 'lucide-react-native'
import { useAuthStore } from '@/store/useAuthStore'

export const BottomNav = () => {
    const pathname = usePathname()
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

    const navItems = [
        { label: 'Home', href: '/', icon: Home },
        { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
        { label: 'Profile', href: isAuthenticated ? '/profile' : '/welcome', icon: User },
    ]

    return (
        <View style={s.nav}>
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                    <Link key={item.href} href={item.href as any} asChild>
                        <TouchableOpacity style={s.item}>
                            {isActive && <View style={s.activeDot} />}
                            <Icon size={20} color={isActive ? '#c9a227' : '#8884a8'} strokeWidth={isActive ? 2.5 : 2} />
                            <Text style={[s.label, isActive && s.labelActive]}>{item.label}</Text>
                        </TouchableOpacity>
                    </Link>
                )
            })}
        </View>
    )
}

const s = StyleSheet.create({
    nav: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 80, backgroundColor: 'rgba(26,26,46,0.95)',
        borderTopWidth: 1, borderTopColor: '#2e2c4e',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
        paddingHorizontal: 32, paddingBottom: 8,
    },
    item: { alignItems: 'center', gap: 4, position: 'relative' },
    activeDot: {
        position: 'absolute', top: -12, width: 4, height: 4,
        borderRadius: 2, backgroundColor: '#c9a227',
    },
    label: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2 },
    labelActive: { color: '#c9a227', fontWeight: 'bold' },
})
