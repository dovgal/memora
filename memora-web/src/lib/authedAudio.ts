import { getSession } from "next-auth/react";

/**
 * Скачивает аудио по URL с bearer-токеном и возвращает object URL для <Audio>.
 * Нужен потому, что серверная генерация TTS «на лету» (/api/audio/{id}/{field}_audio)
 * работает только для авторизованных запросов, а тег <audio src> токен не шлёт.
 * Работает и с data:-URL (просто вернёт его как blob) — единый путь для загруженного
 * и синтезируемого аудио. Вызывающий должен вызвать URL.revokeObjectURL по окончании.
 */
export async function fetchAuthedAudioUrl(url: string): Promise<string> {
    const session = await getSession();
    const token = (session as { id_token?: string } | null)?.id_token;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`audio ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}
