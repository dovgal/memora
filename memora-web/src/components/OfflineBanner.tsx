"use client"

// Баннер «нет сети».
//
// navigator.onLine ненадёжен: он сообщает лишь о наличии сетевого интерфейса,
// а не о доступности сервера, и в части браузеров при загрузке страницы
// возвращает false, будучи онлайн. Прежняя версия верила ему на слово и
// ждала события "online", которого в таком случае не приходит, — баннер висел
// поверх работающего приложения. Поэтому статус подтверждаем настоящим
// запросом к своему же серверу и перепроверяем, пока считаем себя офлайн.

import { useCallback, useEffect, useRef, useState } from "react"
import { WifiOff } from "lucide-react"

/** Интервал перепроверки, пока связь считается потерянной. */
const RECHECK_MS = 10_000

async function serverReachable(): Promise<boolean> {
    try {
        // Любой ответ сервера (даже 404) доказывает, что связь есть.
        await fetch(`/favicon.ico?ping=${Date.now()}`, { method: "HEAD", cache: "no-store" })
        return true
    } catch {
        return false
    }
}

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const check = useCallback(async () => {
        // Если браузер уверенно говорит «офлайн» — проверяем; если «онлайн»,
        // всё равно проверяем, но только когда баннер уже показан.
        const ok = await serverReachable()
        setIsOffline(!ok)
    }, [])

    useEffect(() => {
        // Первую проверку откладываем в таймер: обновлять состояние прямо в теле
        // эффекта нельзя — это лишний каскад рендеров.
        const first = setTimeout(() => { void check() }, 0)
        const onOnline = () => { void check() }
        const onOffline = () => { void check() }
        const onVisible = () => { if (document.visibilityState === "visible") void check() }

        window.addEventListener("online", onOnline)
        window.addEventListener("offline", onOffline)
        document.addEventListener("visibilitychange", onVisible)
        return () => {
            window.removeEventListener("online", onOnline)
            window.removeEventListener("offline", onOffline)
            document.removeEventListener("visibilitychange", onVisible)
            clearTimeout(first)
            if (timer.current) clearTimeout(timer.current)
        }
    }, [check])

    // Пока считаем себя офлайн — перепроверяем, чтобы баннер ушёл сам.
    useEffect(() => {
        if (!isOffline) return
        timer.current = setTimeout(() => { void check() }, RECHECK_MS)
        return () => { if (timer.current) clearTimeout(timer.current) }
    }, [isOffline, check])

    if (!isOffline) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
            <div className="max-w-md mx-auto bg-qz-bg border border-qz-border-light shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-xl p-4 flex items-center gap-4">
                <div className="bg-red-950/40 p-2 rounded-full text-red-500 shrink-0">
                    <WifiOff size={24} />
                </div>
                <div>
                    <h4 className="text-qz-text font-bold text-sm">Нет связи с сервером</h4>
                    <p className="text-qz-text-muted text-xs mt-0.5">
                        Сохранённые наборы доступны, остальное — после восстановления связи.
                        Проверяем автоматически.
                    </p>
                </div>
            </div>
        </div>
    )
}
