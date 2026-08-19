'use client';
// Экранный режим: помогает ребёнку пользоваться телефоном и планшетом так,
// чтобы глаза меньше уставали.
//
// Основа — правило 20-20-20: каждые 20 минут работы вблизи смотреть 20 секунд
// вдаль. Это единственная рекомендация про экраны, которую дают офтальмологи
// повсеместно, поэтому таймер построен вокруг неё, а не вокруг «упражнений».

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Smartphone, Play, Pause, RotateCcw, Bell, BellOff, Timer, Ruler, Sun, Moon, Trees,
} from 'lucide-react';

const KEY = 'memora.vision.screen.v1';
const WORK_MIN = 20;      // минут работы
const BREAK_SEC = 20;     // секунд отдыха

type Phase = 'idle' | 'work' | 'break';

interface Stats { day: string; breaks: number; minutes: number }

function loadStats(): Stats {
  const today = new Date().toISOString().slice(0, 10);
  if (typeof window === 'undefined') return { day: today, breaks: 0, minutes: 0 };
  try {
    const s = JSON.parse(window.localStorage.getItem(KEY) || '') as Stats;
    return s.day === today ? s : { day: today, breaks: 0, minutes: 0 };
  } catch { return { day: today, breaks: 0, minutes: 0 }; }
}

export default function ScreenModePage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(WORK_MIN * 60);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [notify, setNotify] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = useCallback((s: Stats) => {
    setStats(s);
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
  }, []);

  /** Сигнал о смене фазы: уведомление + вибрация, если разрешены. */
  const alert = useCallback((title: string, body: string) => {
    try {
      if (notify && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
      if ('vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
    } catch { /* не критично */ }
  }, [notify]);

  useEffect(() => {
    if (phase === 'idle') { if (tick.current) clearInterval(tick.current); return; }
    tick.current = setInterval(() => {
      setLeft(v => {
        if (v > 1) return v - 1;
        // Фаза закончилась — переключаемся.
        if (phase === 'work') {
          alert('Перерыв для глаз!', 'Посмотри 20 секунд вдаль — в окно, на самый дальний предмет.');
          setPhase('break');
          save({ ...stats, minutes: stats.minutes + WORK_MIN });
          return BREAK_SEC;
        }
        alert('Перерыв окончен', 'Можно возвращаться. Следующий отдых через 20 минут.');
        setPhase('work');
        save({ ...stats, breaks: stats.breaks + 1 });
        return WORK_MIN * 60;
      });
    }, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [phase, alert, save, stats]);

  const askNotify = async () => {
    if (!('Notification' in window)) return;
    const p = await Notification.requestPermission();
    setNotify(p === 'granted');
  };

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const total = phase === 'break' ? BREAK_SEC : WORK_MIN * 60;
  const pct = ((total - left) / total) * 100;
  const isBreak = phase === 'break';

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <Link href="/vision" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-3">
          <ChevronLeft className="w-4 h-4" /> К тренажёру
        </Link>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 mb-2">
          <Smartphone className="w-7 h-7 text-[#4255ff]" /> Экранный режим
        </h1>
        <p className="text-qz-text-muted mb-6 max-w-2xl">
          Телефон и планшет утомляют глаза не «излучением», а тем, что взгляд часами держит одно
          близкое расстояние и мы почти перестаём моргать. Этот режим разрывает и то, и другое.
        </p>

        {/* Таймер */}
        <div className={`rounded-3xl p-7 mb-6 text-center transition-colors ${
          isBreak ? 'bg-emerald-600' : 'bg-[#0b1020]'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isBreak ? 'text-white/80' : 'text-white/50'}`}>
            {phase === 'idle' ? 'Готов начать' : isBreak ? 'Перерыв — смотри вдаль!' : 'Работаем'}
          </p>
          <div className="mx-auto rounded-full flex items-center justify-center mb-4"
            style={{ width: 210, height: 210, background: `conic-gradient(${isBreak ? '#fff' : '#ffd43b'} ${pct * 3.6}deg, rgba(255,255,255,.12) 0deg)` }}>
            <div className={`rounded-full flex flex-col items-center justify-center ${isBreak ? 'bg-emerald-600' : 'bg-[#0b1020]'}`}
              style={{ width: 176, height: 176 }}>
              <span className="text-5xl font-bold text-white tabular-nums">{isBreak ? left : `${mm}:${ss}`}</span>
              <span className="text-white/60 text-sm mt-1">{isBreak ? 'секунд отдыха' : 'до перерыва'}</span>
            </div>
          </div>

          {isBreak && (
            <p className="text-white text-lg font-semibold mb-4">
              👀 Оторвись от экрана и смотри на самый дальний предмет за окном
            </p>
          )}

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setPhase(p => (p === 'idle' ? 'work' : 'idle'))}
              className="inline-flex items-center gap-2 bg-white text-[#0b1020] font-bold px-6 py-3 rounded-2xl hover:bg-white/90 transition-colors"
            >
              {phase === 'idle' ? <><Play className="w-5 h-5" /> Начать</> : <><Pause className="w-5 h-5" /> Стоп</>}
            </button>
            <button onClick={() => { setPhase('idle'); setLeft(WORK_MIN * 60); }}
              className="inline-flex items-center gap-2 border border-white/25 text-white font-semibold px-4 py-3 rounded-2xl hover:bg-white/10">
              <RotateCcw className="w-4 h-4" /> Сброс
            </button>
            <button onClick={notify ? () => setNotify(false) : askNotify}
              className="inline-flex items-center gap-2 border border-white/25 text-white font-semibold px-4 py-3 rounded-2xl hover:bg-white/10">
              {notify ? <><Bell className="w-4 h-4" /> Напоминания включены</> : <><BellOff className="w-4 h-4" /> Включить напоминания</>}
            </button>
          </div>
        </div>

        {/* Итоги дня */}
        <div className="grid grid-cols-2 gap-3 mb-7">
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <Timer className="w-5 h-5 text-[#4255ff] mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.breaks}</p>
            <p className="text-qz-text-muted text-xs">перерывов сегодня</p>
          </div>
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <Smartphone className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.minutes}</p>
            <p className="text-qz-text-muted text-xs">минут за экраном</p>
          </div>
        </div>

        {/* Правила посадки */}
        <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-3">Как держать экран</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-7">
          {[
            { i: <Ruler className="w-5 h-5 text-[#4255ff]" />, t: 'Правило локтя',
              d: 'Телефон — не ближе 33 см: поставь локоть на стол, кулак у подбородка, экран у кончиков пальцев. Планшет — 40 см, компьютер — на вытянутую руку.' },
            { i: <Smartphone className="w-5 h-5 text-[#4255ff]" />, t: 'Экран чуть ниже глаз',
              d: 'Смотреть надо слегка вниз, а не задирать голову. Лёжа и на ходу — нельзя: расстояние всё время скачет, и глаза не успевают наводиться.' },
            { i: <Sun className="w-5 h-5 text-amber-500" />, t: 'Свет в комнате, а не только экран',
              d: 'Яркий экран в тёмной комнате — худшее сочетание. Включи верхний свет или лампу, а яркость экрана подстрой под комнату.' },
            { i: <Moon className="w-5 h-5 text-indigo-400" />, t: 'За час до сна — без экрана',
              d: 'Синий свет вечером мешает заснуть, а недосып сам по себе усиливает усталость глаз.' },
            { i: <Trees className="w-5 h-5 text-emerald-500" />, t: 'Час на улице важнее любых упражнений',
              d: 'Из всего, что связано с детской близорукостью, доказано именно это: 1–2 часа дневного света в день заметно замедляют её развитие.' },
            { i: <Timer className="w-5 h-5 text-[#4255ff]" />, t: 'Сколько экрана в день',
              d: 'Ориентир педиатров: до 5 лет — не более часа, 6–12 лет — около двух, подросткам — с перерывами каждые 20 минут. Уроки в этот счёт не входят, но перерывы нужны и в них.' },
          ].map((r, k) => (
            <div key={k} className="bg-qz-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1.5">{r.i}<p className="font-bold text-foreground text-sm">{r.t}</p></div>
              <p className="text-qz-text-muted text-xs leading-relaxed">{r.d}</p>
            </div>
          ))}
        </div>

        <div className="border-l-4 border-amber-500 bg-amber-500/5 rounded-xl p-4 text-sm text-qz-text-muted">
          <p className="font-bold text-foreground mb-1">Честно о причинах</p>
          <p>
            Экран сам по себе не «сжигает» глаза. Близорукость у детей развивается прежде всего из-за
            долгой работы вблизи и нехватки дневного света — а телефон совмещает и то, и другое.
            Поэтому перерывы и улица работают лучше, чем любые «защитные» очки и плёнки.
          </p>
        </div>
      </div>
    </div>
  );
}
