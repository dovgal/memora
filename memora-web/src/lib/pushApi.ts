// Web Push: подписка PWA на ежедневные напоминания о повторениях.
// Сервер шлёт пуш без payload, текст показывает service worker (app/sw.ts).

function headers(idToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) h['Authorization'] = `Bearer ${idToken}`;
  return h;
}

async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let message = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      if (body?.error) message = body.error;
    } catch { /* нет тела */ }
    throw new Error(message);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

/** base64url VAPID-ключ → Uint8Array для pushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Полный цикл включения: разрешение → подписка у браузера → регистрация на сервере. */
export async function enablePush(idToken?: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано.');

  const { publicKey } = await ok<{ publicKey: string }>(
    await fetch('/api/push/public-key', { headers: headers(idToken) })
  );

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  const json = sub.toJSON();
  await ok(await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      tzOffsetMin: -new Date().getTimezoneOffset(),
    }),
  }));
}

export async function disablePush(idToken?: string): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  await ok(await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ endpoint: sub.endpoint }),
  })).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush(idToken?: string): Promise<{ sent: number; failed: number }> {
  return ok(await fetch('/api/push/test', { method: 'POST', headers: headers(idToken) }));
}
