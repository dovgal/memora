'use client';
// Пароль для входа в приложении на Onyx Boox.
//
// Google намеренно запрещает вход в аккаунт из встроенных браузеров, и обойти
// это подменой опознавания нельзя — да и не нужно. Поэтому в приложении
// остаётся вход по почте и паролю, а у аккаунта, заведённого через Google,
// пароля нет вовсе. Здесь он и задаётся.

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { KeyRound, Check, Loader2 } from 'lucide-react';

export function AppPasswordCard() {
  const { data: session } = useSession();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (password.length < 8) { setError('Не короче восьми символов.'); return; }
    if (password !== repeat) { setError('Пароли не совпадают.'); return; }

    setBusy(true);
    try {
      // Обращаемся к API напрямую: путь /api/auth/* на фронтенде занят
      // системой входа, и до сервера запрос бы не дошёл.
      const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
      const token = (session as { id_token?: string } | null)?.id_token;
      const res = await fetch(`${base}/api/auth/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setDone(true);
      setPassword('');
      setRepeat('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">
        Пароль для приложения
      </h2>
      <div className="bg-qz-card border border-border rounded-2xl p-5 max-w-xl">
        <p className="text-sm text-qz-text-muted mb-1">
          Нужен, чтобы входить в приложении на читалке Onyx Boox.
        </p>
        <p className="text-xs text-qz-text-muted mb-4">
          Вход через Google там не работает: Google не разрешает вход в аккаунт из встроенных
          браузеров. На сайте всё остаётся как было — вход через Google продолжит работать.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Новый пароль</span>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setDone(false); }}
              autoComplete="new-password"
              className="w-full mt-1 bg-transparent border border-border rounded-xl px-3 py-2.5 text-foreground" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Ещё раз</span>
            <input type="password" value={repeat} onChange={e => { setRepeat(e.target.value); setDone(false); }}
              autoComplete="new-password"
              className="w-full mt-1 bg-transparent border border-border rounded-xl px-3 py-2.5 text-foreground" />
          </label>
        </div>

        <button onClick={() => void save()} disabled={busy || !password || !repeat}
          className="mt-4 inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Сохранить пароль
        </button>

        {done && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Готово. В приложении входите этой почтой и паролем.
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{error}</p>
        )}
      </div>
    </section>
  );
}
