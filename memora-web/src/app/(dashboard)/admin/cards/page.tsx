'use client';
// Кабинет администратора: сброс всех наборов карточек семьи перед новым стартом.
//
// Страница видна только тем, кого сервер считает администратором (список
// ADMIN_USER_IDS в окружении) — /api/admin/me решает это, а не роль в токене,
// поэтому проверяем на клиенте перед показом чего-либо.

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, ShieldAlert, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getAdminMe, getSetsSummary, deleteAllSets, DELETE_ALL_CONFIRM_PHRASE,
  type SetsSummary, type DeleteAllSetsResult,
} from '@/lib/adminApi';

export default function AdminCardsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const idToken = session?.id_token as string | undefined;
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [summary, setSummary] = useState<SetsSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [result, setResult] = useState<DeleteAllSetsResult | null>(null);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!idToken) { router.replace('/cabinet'); return; }

    getAdminMe(idToken)
      .then(me => {
        setIsAdmin(me.isAdmin);
        if (!me.isAdmin) { router.replace('/cabinet'); return; }
        return getSetsSummary(idToken).then(setSummary);
      })
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить сводку'))
      .finally(() => setChecking(false));
  }, [idToken, sessionStatus, router]);

  const reload = useCallback(() => {
    if (!idToken) return;
    setLoadError(null);
    getSetsSummary(idToken).then(setSummary).catch(e => setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить сводку'));
  }, [idToken]);

  const handleDelete = async () => {
    if (!idToken || confirmText !== DELETE_ALL_CONFIRM_PHRASE || busy) return;
    if (!confirm('Это необратимо. Точно удалить все карточки всех членов семьи?')) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const r = await deleteAllSets(confirmText, idToken);
      setResult(r);
      setConfirmText('');
      reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-qz-text-muted" />
      </div>
    );
  }

  if (!isAdmin) return null; // уже уходим на /cabinet

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Сброс карточек семьи</h1>
            <p className="text-qz-text-muted text-sm">Видно только администратору. Действие необратимо.</p>
          </div>
        </div>

        {loadError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{loadError}</div>
        )}

        {/* Что именно будет удалено */}
        {summary && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">
              Сейчас в наборах — {summary.totalSets} набор(ов), {summary.totalCards} карточек
            </h2>
            {summary.owners.length === 0 ? (
              <p className="text-qz-text-muted text-sm">Наборов нет — удалять нечего.</p>
            ) : (
              <div className="border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-qz-bg text-qz-text-muted text-xs uppercase tracking-wider">
                      <th className="text-left font-semibold px-4 py-2.5">Кто</th>
                      <th className="text-right font-semibold px-4 py-2.5">Наборов</th>
                      <th className="text-right font-semibold px-4 py-2.5">Карточек</th>
                      <th className="text-left font-semibold px-4 py-2.5">Названия наборов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.owners.map(o => (
                      <tr key={o.userId} className="border-t border-border">
                        <td className="px-4 py-2.5 text-foreground font-medium whitespace-nowrap">{o.name}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{o.setsCount}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">{o.cardsCount}</td>
                        <td className="px-4 py-2.5 text-qz-text-muted">{o.setTitles.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Что теряется и что восстановится само */}
        <section className="bg-qz-card border border-red-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-qz-text space-y-2">
              <p>
                Будут удалены безвозвратно <b>все наборы карточек и сами карточки у всех членов семьи</b>,
                а вместе с ними — весь прогресс изучения по этим карточкам (интервалы повторения, история ответов,
                отметки «знаю / не знаю»).
              </p>
              <p>
                <b>Курс неправильных глаголов</b> и <b>списки слов из книг</b> — не пропадут насовсем: их наборы
                пересоздадутся автоматически при следующем открытии (набор глаголов — при заходе в тренажёр,
                список слов книги — при сохранении следующего слова). Прогресс по ним, впрочем, тоже обнулится,
                потому что живёт в тех же карточках.
              </p>
              <p>
                <b>Сами курсы</b> (юниты, задания, прогресс прохождения тренажёров Édito и других курсов) —
                <b> не затрагиваются</b>: удаляются только наборы карточек, а не курсы.
              </p>
            </div>
          </div>
        </section>

        {/* Подтверждение */}
        {result ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              Готово: удалено наборов — {result.setsDeleted}, карточек — {result.cardsDeleted}.
            </p>
          </div>
        ) : (
          <section className="bg-qz-card border border-border rounded-2xl p-5 space-y-4">
            <label className="block text-sm text-qz-text-muted">
              Чтобы подтвердить, наберите фразу целиком:{' '}
              <span className="font-mono font-semibold text-foreground select-all">{DELETE_ALL_CONFIRM_PHRASE}</span>
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={DELETE_ALL_CONFIRM_PHRASE}
              className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-500/60 font-mono"
              disabled={busy}
            />
            {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
            <button
              onClick={handleDelete}
              disabled={confirmText !== DELETE_ALL_CONFIRM_PHRASE || busy}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Удалить все карточки
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
