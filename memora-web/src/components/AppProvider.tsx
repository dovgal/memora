"use client"

import { SessionProvider } from "next-auth/react"
import { useEffect } from "react"

export default function AppProvider({
    children,
}: {
    children: React.ReactNode
}) {
    useEffect(() => {
        // Unconditionally unregister all service workers to clear stale PWA caches
        // that cause 'bad-precaching-response' 404 errors after deployments.
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
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
