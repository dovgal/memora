'use client';
// Лисёнок-помощник: живёт внизу экрана на всех рабочих страницах.
//
// Сам по себе гуляет, умывается и засыпает, если человек надолго ушёл.
// На события учёбы (lib/fox/bus.ts → emitFox) отвечает реакцией из
// lib/fox/brain.ts: радуется верному ответу, огорчается ошибке, думает вместе
// с тем, кто молчит над вопросом, навостряет уши, когда включён микрофон.
//
// Мешать он не должен: контейнер пропускает щелчки насквозь, ловит их только
// сам рисунок; на медленных экранах и при «уменьшении движения» он не ходит.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  react, greeting, pick, TIPS,
  THINK_AFTER_MS, HINT_AFTER_MS, SLEEP_AFTER_MS,
  type FoxEvent, type FoxMood, type FoxPose, type Reaction,
} from '@/lib/fox/brain';
import { onFox, foxEnabled } from '@/lib/fox/bus';
import { FOX_SVG, CONFETTI_COLORS } from './foxArt';

// Входа, печати и живой игры на большом экране лисёнок не касается.
const HIDDEN_PATHS = [/^\/$/, /^\/login/, /^\/register/, /^\/auth/, /^\/live/, /\/print/];

const WALK_SPEED = 70; // px/с — неторопливо, чтобы не отвлекал от текста
const EDGE = 8;

interface Look {
  pose: FoxPose;
  mood: FoxMood;
  walking: boolean;
  wag: boolean;
  wave: boolean;
  wash: boolean;
}

const REST: Look = { pose: 'stand', mood: '', walking: false, wag: false, wave: false, wash: false };

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function Fox() {
  const pathname = usePathname() ?? '';
  const [enabled, setEnabled] = useState(false);
  const [shown, setShown] = useState(false);
  const [look, setLook] = useState<Look>({ ...REST, pose: 'ball', mood: 'sleep' });
  const [bubble, setBubble] = useState<string | null>(null);
  const [x, setX] = useState(EDGE);
  const [dir, setDir] = useState<1 | -1>(1);
  const [calm, setCalm] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const jumperRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(EDGE);
  const busyUntil = useRef(0);
  const walkToken = useRef(0);
  const sleeping = useRef(true);
  const dismissed = useRef(false);
  const lastActivity = useRef(0);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thinkTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hiddenHere = HIDDEN_PATHS.some(re => re.test(pathname));

  // Настройка и «спокойный режим» читаются в браузере после монтирования:
  // на сервере ни localStorage, ни медиазапросов нет.
  useEffect(() => {
    const read = () => {
      setEnabled(foxEnabled());
      try { dismissed.current = sessionStorage.getItem('memora.fox.dismissed') === '1'; } catch { /* нет хранилища */ }
    };
    read();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const eink = document.documentElement.getAttribute('data-eink') === 'on';
    setCalm(reduced || eink);
    lastActivity.current = Date.now();
    window.addEventListener('memora-fox-pref', read);
    return () => window.removeEventListener('memora-fox-pref', read);
  }, []);

  const say = useCallback((text: string | null, ms = 2400) => {
    setBubble(text);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    if (text && ms > 0) bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  const maxX = () => Math.max(EDGE, window.innerWidth - (rootRef.current?.offsetWidth ?? 120) - EDGE);

  const stopWalking = () => { walkToken.current++; setLook(l => ({ ...l, walking: false })); };

  const walkTo = useCallback(async (target: number) => {
    const token = ++walkToken.current;
    const to = Math.min(Math.max(EDGE, target), maxX());
    setDir(to >= xRef.current ? 1 : -1);
    setLook(l => ({ ...REST, walking: true, wag: l.wag }));
    let last = performance.now();
    while (Math.abs(to - xRef.current) > 2 && token === walkToken.current) {
      const now = await new Promise<number>(r => requestAnimationFrame(r));
      const step = Math.min(40, ((now - last) / 1000) * WALK_SPEED);
      last = now;
      xRef.current += Math.sign(to - xRef.current) * Math.min(step, Math.abs(to - xRef.current));
      setX(xRef.current);
    }
    if (token === walkToken.current) setLook(l => ({ ...l, walking: false }));
  }, []);

  const jump = (kind: 'jump' | 'spin') => {
    const el = jumperRef.current;
    if (!el || calm) return;
    el.classList.remove('mfx-jump', 'mfx-spin');
    void el.offsetWidth; // перезапуск анимации, если прыжок уже шёл
    el.classList.add(kind === 'spin' ? 'mfx-spin' : 'mfx-jump');
  };

  const confetti = useCallback((bursts: number) => {
    if (calm || !rootRef.current) return;
    const box = rootRef.current.getBoundingClientRect();
    for (let b = 0; b < bursts; b++) {
      setTimeout(() => {
        for (let i = 0; i < 24; i++) {
          const p = document.createElement('div');
          p.className = 'mfx-confetti';
          p.style.left = `${box.left + box.width / 2}px`;
          p.style.top = `${box.top + box.height / 3}px`;
          p.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          document.body.appendChild(p);
          const dx = (Math.random() - 0.5) * 320;
          const dy = -(60 + Math.random() * 140);
          p.animate([
            { transform: 'translate(0,0) rotate(0)', opacity: 1 },
            { transform: `translate(${dx * 0.6}px,${dy}px) rotate(200deg)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${dx}px,60px) rotate(420deg)`, opacity: 0 },
          ], { duration: 1400, easing: 'ease-out' }).onfinish = () => p.remove();
        }
      }, b * 450);
    }
  }, [calm]);

  const perform = useCallback((r: Reaction) => {
    stopWalking();
    busyUntil.current = Date.now() + r.ms;
    setLook({ ...REST, pose: r.pose, mood: r.mood, wag: !!r.wag, wave: !!r.wave });
    if (r.jump) jump(r.jump);
    if (r.confetti) confetti(r.confetti);
    if (r.say) say(r.say, Math.min(r.ms + 600, 4000));
    const until = busyUntil.current;
    setTimeout(() => {
      // Вернулся к своим делам, только если за это время не случилось новое событие.
      if (busyUntil.current === until) setLook(l => ({ ...l, mood: l.mood === 'listen' ? l.mood : '', wag: false, wave: false }));
    }, r.ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confetti, say, calm]);

  const appear = useCallback(async (text?: string) => {
    if (dismissed.current) return;
    sleeping.current = false;
    setLook({ ...REST, pose: 'ball', mood: 'sleep' });
    setShown(true);
    await wait(650);
    setLook({ ...REST, wave: true });
    if (text) say(text, 2600);
    busyUntil.current = Date.now() + 1800;
    await wait(1800);
    setLook(l => ({ ...l, wave: false }));
  }, [say]);

  const fallAsleep = useCallback(async () => {
    if (sleeping.current) return;
    sleeping.current = true;
    stopWalking();
    busyUntil.current = Infinity;
    setLook({ ...REST, pose: 'sit' });
    say('Ааах… вздремну', 1400);
    await wait(1300);
    setLook({ ...REST, pose: 'ball', mood: 'sleep' });
    await wait(2400);
    if (sleeping.current) setShown(false);
  }, [say]);

  const clearThinking = () => { thinkTimers.current.forEach(clearTimeout); thinkTimers.current = []; };

  // События учёбы.
  useEffect(() => {
    if (!enabled || hiddenHere) return;
    return onFox((e: FoxEvent) => {
      if (dismissed.current) return;
      lastActivity.current = Date.now();
      if (sleeping.current) void appear();
      if (e.type === 'question') {
        clearThinking();
        thinkTimers.current.push(setTimeout(() => {
          perform({ pose: 'sit', mood: 'think', say: 'Хм… не торопитесь', ms: HINT_AFTER_MS - THINK_AFTER_MS });
        }, THINK_AFTER_MS));
        thinkTimers.current.push(setTimeout(() => say('Застряли? Загляните в подсказку', 4000), HINT_AFTER_MS));
        return;
      }
      if (e.type === 'correct' || e.type === 'wrong' || e.type === 'answered') clearThinking();
      if (e.type === 'listen_end') {
        busyUntil.current = 0;
        setLook(l => ({ ...l, mood: '' }));
        say(null);
        return;
      }
      const r = react(e);
      if (r) perform(r);
    });
  }, [enabled, hiddenHere, appear, perform, say]);

  // Появление при входе и сон, если человек надолго ушёл.
  useEffect(() => {
    if (!enabled || hiddenHere) return;
    let greeted = false;
    try { greeted = sessionStorage.getItem('memora.fox.greeted') === '1'; sessionStorage.setItem('memora.fox.greeted', '1'); } catch { /* ок */ }
    const start = setTimeout(() => void appear(greeted ? undefined : greeting(new Date().getHours())), 1200);

    let lastMove = 0;
    const onActivity = (ev: Event) => {
      // Движение мыши считаем не чаще раза в секунду — его события сыплются сотнями.
      if (ev.type === 'pointermove') { const n = Date.now(); if (n - lastMove < 1000) return; lastMove = n; }
      lastActivity.current = Date.now();
      if (sleeping.current && !dismissed.current) void appear();
    };
    const kinds = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'pointermove'];
    kinds.forEach(k => window.addEventListener(k, onActivity, { passive: true }));

    const tick = setInterval(() => {
      if (!sleeping.current && Date.now() - lastActivity.current > SLEEP_AFTER_MS) void fallAsleep();
    }, 5000);

    return () => {
      clearTimeout(start);
      clearInterval(tick);
      kinds.forEach(k => window.removeEventListener(k, onActivity));
    };
  }, [enabled, hiddenHere, appear, fallAsleep]);

  // Своя жизнь в перерывах между событиями: прогулка, умывание, передышка.
  useEffect(() => {
    if (!enabled || hiddenHere || calm) return;
    let next = Date.now() + 8000;
    const loop = setInterval(() => {
      const now = Date.now();
      if (sleeping.current || now < busyUntil.current || now < next) return;
      next = now + 12_000 + Math.random() * 18_000;
      const roll = Math.random();
      if (roll < 0.6) {
        void walkTo(EDGE + Math.random() * (maxX() - EDGE));
      } else if (roll < 0.85) {
        busyUntil.current = now + 2600;
        setLook({ ...REST, pose: 'sit', wash: true });
        setTimeout(() => setLook(l => ({ ...l, wash: false })), 2500);
      } else {
        setLook({ ...REST, pose: 'sit' });
      }
    }, 1000);
    const onResize = () => { xRef.current = Math.min(xRef.current, maxX()); setX(xRef.current); };
    window.addEventListener('resize', onResize);
    return () => { clearInterval(loop); window.removeEventListener('resize', onResize); };
  }, [enabled, hiddenHere, calm, walkTo]);

  const clicks = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onClick = () => {
    // Одиночный щелчок — совет, двойной — спрятаться до следующего раза.
    if (clicks.current) {
      clearTimeout(clicks.current);
      clicks.current = null;
      dismissed.current = true;
      try { sessionStorage.setItem('memora.fox.dismissed', '1'); } catch { /* ок */ }
      say('Спрячусь. Вернуть меня можно в кабинете', 2200);
      sleeping.current = false;
      void fallAsleep();
      return;
    }
    clicks.current = setTimeout(() => {
      clicks.current = null;
      perform({ pose: 'stand', mood: 'happy', jump: 'jump', wag: true, say: pick(TIPS), ms: 3600 });
    }, 280);
  };

  const svgClass = useMemo(() => [
    'mfx',
    `pose-${look.pose}`,
    look.mood && `mood-${look.mood}`,
    look.walking && 'walking',
    look.wag && 'wag',
    look.wave && 'wave',
    look.wash && 'wash',
    calm && 'calm',
  ].filter(Boolean).join(' '), [look, calm]);

  if (!enabled || hiddenHere) return null;

  const nearRight = typeof window !== 'undefined' && x > window.innerWidth / 2;

  return (
    <div
      ref={rootRef}
      className="mfx-root"
      style={{ left: x, opacity: shown ? 1 : 0, transform: shown ? 'scale(1)' : 'scale(0)' }}
      aria-hidden="true"
    >
      {bubble && <div className={`mfx-bubble ${nearRight ? 'mfx-bubble-left' : ''}`}>{bubble}</div>}
      <div ref={jumperRef} className="mfx-jumper" onAnimationEnd={e => e.currentTarget.classList.remove('mfx-jump', 'mfx-spin')}>
        <div style={{ transform: `scaleX(${dir})` }}>
          <svg
            className={svgClass}
            viewBox="0 0 170 120"
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: FOX_SVG }}
          />
        </div>
      </div>
    </div>
  );
}
