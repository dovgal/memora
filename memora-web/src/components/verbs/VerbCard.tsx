'use client';
// Одна карточка занятия: сперва формы по инфинитиву — как в школе, — потом,
// отдельным шагом, перевод на французский. После форм сразу показываем
// семейство глагола тем же значком и цветом, что в таблице: это и есть
// главная мысль пособия, и закреплять её нужно на каждой карточке, а не
// только по хотению.

import { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { FAMILY_META, familyOf, type IrregularVerb } from '@/lib/courses/verbs/types';
import { isFormCorrect } from '@/lib/courses/verbs/match';

type Stage = 'forms' | 'formsResult' | 'translate' | 'translateResult';

const verbIconSrc = (n: number) => `/verbs/${String(n).padStart(3, '0')}.webp`;

export function VerbCard({
  verb, onFormsChecked, onDone,
}: {
  verb: IrregularVerb;
  /** Зовём сразу после проверки форм — родитель шлёт результат на сервер. */
  onFormsChecked: (correct: boolean) => void;
  /** Карточка закрыта, можно показывать следующую. */
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>('forms');
  const [pret, setPret] = useState('');
  const [pp, setPp] = useState('');
  const [pretOk, setPretOk] = useState(false);
  const [ppOk, setPpOk] = useState(false);
  const [translation, setTranslation] = useState('');
  const [translationOk, setTranslationOk] = useState(false);

  const family = FAMILY_META[familyOf(verb)];

  const checkForms = () => {
    if (!pret.trim() || !pp.trim()) return;
    const okPret = isFormCorrect(pret, verb.pret);
    const okPp = isFormCorrect(pp, verb.pp);
    setPretOk(okPret);
    setPpOk(okPp);
    onFormsChecked(okPret && okPp);
    setStage('formsResult');
  };

  const checkTranslation = () => {
    if (!translation.trim()) return;
    setTranslationOk(isFormCorrect(translation, verb.fr));
    setStage('translateResult');
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6 space-y-5">
      {/*
        Значок стоит отдельной строкой и во всю ширину: в таблице это широкая
        полоса с одной-двумя картинками (в среднем 2,4 к 1), и в квадратной
        рамке от неё оставалось бы 64 точки на 27 — узнать сценку нельзя.
      */}
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- значков всего 125, статическая раздача из /public */}
        <img
          src={verbIconSrc(verb.n)}
          alt={verb.inf}
          className="h-28 sm:h-32 w-auto max-w-full mx-auto object-contain rounded-xl border border-border bg-white"
        />
        <div className="text-center">
          <p className="text-xs text-qz-text-muted font-semibold uppercase tracking-wider">№{verb.n}</p>
          <h2 className="text-2xl font-bold text-foreground">{verb.inf}</h2>
        </div>
      </div>

      {(stage === 'forms' || stage === 'formsResult') && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-qz-text-muted font-semibold">Prétérit (2 форма)</span>
              <input
                value={pret}
                onChange={e => setPret(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkForms()}
                disabled={stage === 'formsResult'}
                autoFocus
                className={`mt-1 w-full bg-qz-bg border rounded-xl px-3 py-2.5 text-foreground outline-none ${
                  stage === 'formsResult' ? (pretOk ? 'border-emerald-500' : 'border-red-500') : 'border-border focus:border-[#4255ff]/60'
                }`}
              />
              {stage === 'formsResult' && !pretOk && (
                <span className="text-xs text-red-500 mt-1 block">верно: {verb.pret}</span>
              )}
            </label>
            <label className="block">
              <span className="text-xs text-qz-text-muted font-semibold">Participe passé (3 форма)</span>
              <input
                value={pp}
                onChange={e => setPp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkForms()}
                disabled={stage === 'formsResult'}
                className={`mt-1 w-full bg-qz-bg border rounded-xl px-3 py-2.5 text-foreground outline-none ${
                  stage === 'formsResult' ? (ppOk ? 'border-emerald-500' : 'border-red-500') : 'border-border focus:border-[#4255ff]/60'
                }`}
              />
              {stage === 'formsResult' && !ppOk && (
                <span className="text-xs text-red-500 mt-1 block">верно: {verb.pp}</span>
              )}
            </label>
          </div>

          {stage === 'forms' && (
            <button
              onClick={checkForms}
              disabled={!pret.trim() || !pp.trim()}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-40 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              Проверить
            </button>
          )}

          {stage === 'formsResult' && (
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
                style={{ backgroundColor: family.color, borderColor: family.color, color: '#1a1d28' }}
              >
                <span className="font-mono">{family.mark}</span>
                <span>{family.title}</span>
              </div>
              <div>
                <button
                  onClick={() => setStage('translate')}
                  className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                >
                  Дальше — перевод <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(stage === 'translate' || stage === 'translateResult') && (
        <div className="space-y-3 pt-1 border-t border-qz-border-light">
          <label className="block max-w-xs">
            <span className="text-xs text-qz-text-muted font-semibold">Перевод на французский: {verb.inf}</span>
            <input
              value={translation}
              onChange={e => setTranslation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkTranslation()}
              disabled={stage === 'translateResult'}
              autoFocus
              className={`mt-1 w-full bg-qz-bg border rounded-xl px-3 py-2.5 text-foreground outline-none ${
                stage === 'translateResult' ? (translationOk ? 'border-emerald-500' : 'border-red-500') : 'border-border focus:border-[#4255ff]/60'
              }`}
            />
          </label>

          {stage === 'translate' && (
            <button
              onClick={checkTranslation}
              disabled={!translation.trim()}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-40 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              Проверить перевод
            </button>
          )}

          {stage === 'translateResult' && (
            <div className="space-y-3">
              <div className={`inline-flex items-center gap-2 text-sm font-semibold ${translationOk ? 'text-emerald-600' : 'text-red-500'}`}>
                {translationOk ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {translationOk ? 'Верно' : `Верно: ${verb.fr}`}
              </div>
              <button
                onClick={onDone}
                className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                Следующий глагол <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
