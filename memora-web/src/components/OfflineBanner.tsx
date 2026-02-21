"use client"

import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false)

    useEffect(() => {
        // Check initial state
        setIsOffline(!navigator.onLine)

        const handleOnline = () => setIsOffline(false)
        const handleOffline = () => setIsOffline(true)

        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
        }
    }, [])

    if (!isOffline) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
            <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-xl p-4 flex items-center gap-4">
                <div className="bg-red-950/40 p-2 rounded-full text-red-500 shrink-0">
                    <WifiOff size={24} />
                </div>
                <div>
                    <h4 className="text-white font-bold text-sm">You are offline</h4>
                    <p className="text-zinc-400 text-xs mt-0.5">
                        You can still view cached study sets, but some features may be unavailable.
                    </p>
                </div>
            </div>
        </div>
    )
}
