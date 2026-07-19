'use client';
// Уведомления: ежедневные push-напоминания о повторениях (Web Push).
// Напоминание приходит в час PUSH_REMINDER_HOUR (сервер, по умолчанию 18:00
// локального времени), только если есть просроченные повторения и сегодня
// ещё не занимался.

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, BellOff, BellRing, Loader2, Send } from 'lucide-react';
import {
  pushSupported, getCurrentSubscription, enablePush, disablePush, sendTestPush,
} from '@/lib/pushApi';

type PushState = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

export default function NotificationsPage() {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const finish = (s: PushState) => { if (!done) { done = true; setState(s); } };
    // Страховка: что бы ни случилось с SW-API, не зависаем на 'loading'.
    const guard = setTimeout(() => finish('off'), 6000);
    (async () => {
      if (!pushSupported()) { finish('unsupported'); return; }
      if (Notification.permission === 'denied') { finish('denied'); return; }
      const sub = await getCurrentSubscription().catch(() => null);
      finish(sub ? 'on' : 'off');
    })().finally(() => clearTimeout(guard));
    return () => clearTimeout(guard);
  }, []);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await enablePush(idToken);
      setState('on');
      setMessage('Напоминания включены. Придут вечером, если остались повторения.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось включить уведомления');
      if (Notification.permission === 'denied') setState('denied');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await disablePush(idToken);
      setState('off');
      setMessage('Напоминания выключены на этом устройстве.');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await sendTestPush(idToken);
      setMessage(r.sent > 0
        ? `Тест отправлен (устройств: ${r.sent}). Уведомление должно появиться через пару секунд.`
        : 'Отправить не удалось — проверьте настройку VAPID на сервере.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка тестовой отправки');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-6">
          <Bell className="text-[#4255ff] w-8 h-8" />
          Уведомления
        </h1>

        <div className="bg-qz-card border border-border rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              state === 'on' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-qz-text-muted'
            }`}>
              {state === 'on' ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <p className="text-foreground font-semibold mb-1">Ежедневное напоминание о повторениях</p>
              <p className="text-qz-text-muted text-sm mb-4">
                Вечером, если у вас остались просроченные повторения и вы сегодня ещё
                не занимались, придёт push «Пора повторять». Одно напоминание в день —
                без спама. Интервальное повторение работает только при регулярности.
              </p>

              {state === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-qz-text-muted" />}

              {state === 'unsupported' && (
                <p className="text-amber-400 text-sm">
                  Этот браузер не поддерживает push-уведомления. На iPhone — добавьте
                  Memora на экран «Домой» (PWA) и откройте оттуда.
                </p>
              )}

              {state === 'denied' && (
                <p className="text-amber-400 text-sm">
                  Уведомления запрещены в настройках браузера для этого сайта —
                  разрешите их и обновите страницу.
                </p>
              )}

              {state === 'off' && (
                <button
                  onClick={enable}
                  disabled={busy}
                  className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                  Включить напоминания
                </button>
              )}

              {state === 'on' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={test}
                    disabled={busy}
                    className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 disabled:opacity-50 text-foreground text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Отправить тест
                  </button>
                  <button
                    onClick={disable}
                    disabled={busy}
                    className="text-qz-text-muted hover:text-foreground text-sm underline disabled:opacity-50"
                  >
                    Выключить на этом устройстве
                  </button>
                </div>
              )}

              {message && <p className="text-qz-text-muted text-sm mt-3">{message}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
