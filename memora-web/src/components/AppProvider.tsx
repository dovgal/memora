"use client"

import { SessionProvider } from "next-auth/react"
import { useEffect } from "react"

export default function AppProvider({
    children,
}: {
    children: React.ReactNode
}) {
    useEffect(() => {
        // Clear Service Worker if there's an install error (Fixes 404 bad-precaching-response)
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            // Global handler for bad precaching errors to prevent white screen
            window.addEventListener('unhandledrejection', (event) => {
                if (event.reason && (event.reason.name === 'bad-precaching-response' || 
                    (typeof event.reason.toString === 'function' && event.reason.toString().includes('bad-precaching-response')))) {
                    console.warn('[Memora] PWA Precache Error detected. Forcing Refresh...');
                    navigator.serviceWorker.getRegistrations().then(regs => {
                        regs.forEach(r => r.unregister());
                        window.location.reload();
                    });
                }
            });
        }
    }, []);

    return (
        <SessionProvider>
            {children}
        </SessionProvider>
    )
}
