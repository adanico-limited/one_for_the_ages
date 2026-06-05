'use client'

import { ReactNode } from 'react'
import Image from 'next/image'

interface AppShellProps {
    children: ReactNode
    className?: string
}

export const AppShell = ({ children, className = '' }: AppShellProps) => {
    return (
        <main className={`min-h-screen w-full max-w-md mx-auto ${className}`}>
            <div className="absolute top-3 left-3 z-50 pointer-events-none select-none" style={{ mixBlendMode: 'screen' }}>
                <Image
                    src="/images/logo.png"
                    alt="OFTA"
                    width={54}
                    height={20}
                    className="opacity-50"
                    style={{ width: 54, height: 'auto' }}
                    priority
                />
            </div>
            {children}
        </main>
    )
}
