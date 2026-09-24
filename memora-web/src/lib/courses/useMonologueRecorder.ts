'use client';
// Запись длинного ответа — минута-две рассказа о себе.
//
// От useSpeechAttempt (одна фраза) отличается главным: запись режется на
// куски по 12–24 секунды, и каждый кусок распознаётся на сервере сразу, пока
// человек ещё говорит. Цельная двухминутная запись распознавалась бы дольше,
// чем прокси веб-приложения держит запрос (30 секунд), и к концу рассказа
// человек ждал бы разбора впустую. Режем по паузе между фразами, а не по
// часам, — иначе слово на стыке кусков распознаётся обрубком.
//
// Браузерное распознавание идёт параллельно как страховка: на длинной речи
// оно ненадёжно, но лучше, чем ничего, если сервис не настроен или не ответил.

import { useCallback, useEffect, useRef, useState } from 'react';
import { chooseMic, getPreferredMic, getSpeechRecognition, hasMediaDevices, type SpeechRecognitionLike } from '@/lib/speech';
import { emitFox } from '@/lib/fox/bus';
import { micConstraints, openMic } from './useSpeechAttempt';
import { pickTranscript, type ChunkTranscript, type PickedTranscript } from './monologue';
import { serverSttOff, transcribeChunk } from './monologueApi';

/** Раньше этого кусок не режем: короткие куски модель распознаёт хуже. */
const MIN_CHUNK_MS = 12_000;
/** Дольше — режем, даже если паузы нет: иначе не уложимся в предел прокси. */
const MAX_CHUNK_MS = 24_000;
/** Без анализатора звука паузу не найти — режем по часам. */
const BLIND_CHUNK_MS = 20_000;
/** Громкость (RMS), ниже которой считаем, что человек молчит. */
const QUIET_RMS = 0.015;
/** Столько тишины — уже пауза между словами, а не провал внутри слова. */
const QUIET_MS = 350;
/** Кусок короче этого распознавать незачем: на обрывке модель досочиняет. */
const MIN_SEND_MS = 800;
const TICK_MS = 150;
/** Дольше разбора распознавания не ждём: берём, что успело прийти. */
const FINISH_WAIT_MS = 45_000;

export type RecorderPhase = 'idle' | 'starting' | 'recording' | 'finishing';

export interface MonologueCapture extends PickedTranscript {
  durationSeconds: number;
}

/** Итог куска: распознан, не распознан (null) или намеренно не отправлялся. */
type ChunkOutcome = ChunkTranscript | null | 'skipped';

const sleep = <T,>(ms: number, value: T) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

/**
 * Микрофон — по тем же правилам, что и в тренажёре произношения: запомненное
 * устройство, иначе встроенное (Bluetooth-гарнитура режет полосу голоса).
 * Исключения (нет доступа, нет устройства) пробрасываются вызывающему.
 */
async function openBestMic(): Promise<{ stream: MediaStream; label: string | null } | null> {
  const remembered = getPreferredMic();
  let stream = remembered ? await openMic(micConstraints(remembered)).catch(() => null) : null;
  if (!stream) stream = await openMic(micConstraints());
  if (!stream) return null;
  const current = stream.getAudioTracks()[0]?.getSettings().deviceId;
  const wanted = await chooseMic();
  if (wanted && current && wanted.deviceId !== current) {
    const swapped = await openMic(micConstraints(wanted.deviceId)).catch(() => null);
    if (swapped) {
      stream.getTracks().forEach(t => t.stop());
      return { stream: swapped, label: wanted.label };
    }
  }
  return { stream, label: wanted?.label ?? stream.getAudioTracks()[0]?.label ?? null };
}

export interface MonologueRecorder {
  phase: RecorderPhase;
  /** Секунды с начала записи. */
  elapsed: number;
  /** Громкость голоса 0…1 — для живого индикатора. */
  level: number;
  /** Сколько кусков ещё распознаётся на сервере. */
  pending: number;
  error: string | null;
  /** Запись целиком — «послушать себя». */
  selfUrl: string | null;
  micLabel: string | null;
  supported: boolean;
  start: () => Promise<boolean>;
  /** Остановить и дождаться распознавания. null — записи не было. */
  stop: () => Promise<MonologueCapture | null>;
  /** Забыть прошлую запись перед новой попыткой. */
  reset: () => void;
}

export function useMonologueRecorder(speechLang = 'fr-FR'): MonologueRecorder {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selfUrl, setSelfUrl] = useState<string | null>(null);
  const [micLabel, setMicLabel] = useState<string | null>(null);

  const liveRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fullRecRef = useRef<MediaRecorder | null>(null);
  const fullBlobRef = useRef<Promise<Blob | null> | null>(null);
  const chunkRecRef = useRef<MediaRecorder | null>(null);
  const chunkStartRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const chunkJobsRef = useRef<Promise<ChunkOutcome>[]>([]);
  /** Куски распознаются по очереди: сервис на процессоре, параллель лишь растянет каждый. */
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const startedAtRef = useRef(0);
  const quietSinceRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const browserTextRef = useRef('');
  const sessionBaseRef = useRef('');
  const selfUrlRef = useRef<string | null>(null);

  const supported = hasMediaDevices() && typeof window !== 'undefined' && 'MediaRecorder' in window;

  /** Освободить микрофон и всё, что на нём висит. Идемпотентно. */
  const release = useCallback(() => {
    liveRef.current = false;
    if (tickRef.current !== null) { window.clearInterval(tickRef.current); tickRef.current = null; }
    try { recognitionRef.current?.stop(); } catch { /* уже остановлено */ }
    recognitionRef.current = null;
    for (const rec of [chunkRecRef.current, fullRecRef.current]) {
      try { if (rec && rec.state !== 'inactive') rec.stop(); } catch { /* уже остановлено */ }
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
  }, []);

  // Ушли со страницы посреди записи — микрофон не должен остаться включённым.
  useEffect(() => () => {
    release();
    if (selfUrlRef.current) URL.revokeObjectURL(selfUrlRef.current);
  }, [release]);

  const startChunk = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(stream); } catch { return; }
    const index = chunkIndexRef.current++;
    const startedAt = performance.now();
    const offset = (startedAt - startedAtRef.current) / 1000;
    const parts: Blob[] = [];
    const blob = new Promise<Blob | null>(resolve => {
      rec.ondataavailable = ev => { if (ev.data.size > 0) parts.push(ev.data); };
      rec.onstop = () => {
        const long = performance.now() - startedAt >= MIN_SEND_MS;
        resolve(long && parts.length ? new Blob(parts, { type: parts[0].type || 'audio/webm' }) : null);
      };
    });
    const job = blob.then((b): ChunkOutcome | Promise<ChunkOutcome> => {
      if (!b || serverSttOff()) return 'skipped';
      setPending(n => n + 1);
      const run = queueRef.current.then(() => transcribeChunk(b, speechLang, index, offset));
      queueRef.current = run.catch(() => null);
      return run.finally(() => setPending(n => Math.max(0, n - 1)));
    });
    chunkJobsRef.current.push(job);
    rec.start();
    chunkRecRef.current = rec;
    chunkStartRef.current = startedAt;
    quietSinceRef.current = null;
  }, [speechLang]);

  /** Новый кусок начинаем до остановки старого: стык внахлёст лучше дыры. */
  const rotate = useCallback(() => {
    const old = chunkRecRef.current;
    startChunk();
    try { if (old && old.state !== 'inactive') old.stop(); } catch { /* уже остановлен */ }
  }, [startChunk]);

  const tick = useCallback(() => {
    const now = performance.now();
    setElapsed((now - startedAtRef.current) / 1000);
    const analyser = analyserRef.current;
    let rms = 0;
    if (analyser) {
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const x of buf) sum += x * x;
      rms = Math.sqrt(sum / buf.length);
      if (rms < QUIET_RMS) quietSinceRef.current ??= now;
      else quietSinceRef.current = null;
    }
    setLevel(Math.min(1, rms * 8));
    const age = now - chunkStartRef.current;
    const pause = quietSinceRef.current !== null && now - quietSinceRef.current >= QUIET_MS;
    const cut = analyser ? age >= MIN_CHUNK_MS && pause : age >= BLIND_CHUNK_MS;
    if (cut || age >= MAX_CHUNK_MS) rotate();
  }, [rotate]);

  const start = useCallback(async (): Promise<boolean> => {
    if (liveRef.current) return false;
    setError(null);
    if (!supported) {
      setError('Этот браузер не умеет записывать с микрофона — напишите ответ текстом.');
      return false;
    }
    setPhase('starting');
    release();

    let opened: Awaited<ReturnType<typeof openBestMic>>;
    try {
      opened = await openBestMic();
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      setError(name === 'NotFoundError' || name === 'DevicesNotFoundError'
        ? 'Микрофон не найден. Проверьте, что он подключён, — или напишите ответ текстом.'
        : 'Доступ к микрофону не выдан. Нажмите «Разрешить» в запросе браузера или включите микрофон в настройках сайта.');
      setPhase('idle');
      return false;
    }
    if (!opened) {
      setError('Микрофон не ответил. Закройте другие вкладки и программы, которые могут его занимать, и попробуйте ещё раз.');
      setPhase('idle');
      return false;
    }
    const { stream } = opened;
    streamRef.current = stream;
    setMicLabel(opened.label);

    // Анализатор нужен для индикатора голоса и чтобы резать запись по паузам.
    // Нет его — запись всё равно идёт, режем по часам.
    try {
      const Ctx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        void ctx.resume().catch(() => {});
        ctxRef.current = ctx;
        analyserRef.current = analyser;
      }
    } catch { analyserRef.current = null; }

    // Цельная запись — только чтобы послушать себя: куски по отдельности
    // подряд не проигрываются.
    try {
      const full = new MediaRecorder(stream);
      const parts: Blob[] = [];
      fullBlobRef.current = new Promise<Blob | null>(resolve => {
        full.ondataavailable = ev => { if (ev.data.size > 0) parts.push(ev.data); };
        full.onstop = () => resolve(parts.length ? new Blob(parts, { type: parts[0].type || 'audio/webm' }) : null);
      });
      full.start();
      fullRecRef.current = full;
    } catch {
      release();
      setError('Не удалось начать запись. Попробуйте Chrome или Safari — или напишите ответ текстом.');
      setPhase('idle');
      return false;
    }

    startedAtRef.current = performance.now();
    chunkIndexRef.current = 0;
    chunkJobsRef.current = [];
    queueRef.current = Promise.resolve();
    setPending(0);
    startChunk();

    browserTextRef.current = '';
    sessionBaseRef.current = '';
    const SR = getSpeechRecognition();
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = speechLang;
        rec.interimResults = false;
        rec.continuous = true;
        rec.maxAlternatives = 1;
        rec.onresult = event => {
          let full = '';
          for (let i = 0; i < event.results.length; i++) full += (event.results[i]?.[0]?.transcript ?? '') + ' ';
          browserTextRef.current = `${sessionBaseRef.current} ${full}`.trim();
        };
        // Движок сам останавливается на паузах; накопленное фиксируем, иначе
        // после перезапуска нумерация обнуляется и начало рассказа теряется.
        rec.onend = () => {
          if (!liveRef.current) return;
          sessionBaseRef.current = browserTextRef.current;
          try { rec.start(); } catch { /* перезапуск не удался — останется сервер */ }
        };
        rec.onerror = () => {};
        recognitionRef.current = rec;
        rec.start();
      } catch { /* браузер не распознаёт — полагаемся на сервер */ }
    }

    liveRef.current = true;
    tickRef.current = window.setInterval(tick, TICK_MS);
    setElapsed(0);
    setPhase('recording');
    // Отсчёт «думает над вопросом» снимаем: человек уже отвечает.
    emitFox({ type: 'answered' });
    emitFox({ type: 'listen_start' });
    return true;
  }, [supported, release, startChunk, tick, speechLang]);

  const stop = useCallback(async (): Promise<MonologueCapture | null> => {
    if (!liveRef.current) return null;
    const durationSeconds = (performance.now() - startedAtRef.current) / 1000;
    const fullBlob = fullBlobRef.current;
    const jobs = chunkJobsRef.current;
    setPhase('finishing');
    setLevel(0);
    release();
    emitFox({ type: 'listen_end' });

    const blob = await Promise.race([fullBlob ?? Promise.resolve(null), sleep(3000, null)]);
    if (blob) {
      const url = URL.createObjectURL(blob);
      if (selfUrlRef.current) URL.revokeObjectURL(selfUrlRef.current);
      selfUrlRef.current = url;
      setSelfUrl(url);
    }
    // Браузерный движок отдаёт последние слова уже после остановки.
    await sleep(1000, null);

    const deadline = sleep<ChunkOutcome>(FINISH_WAIT_MS, null);
    const outcomes = await Promise.all(jobs.map(j => Promise.race([j, deadline])));
    const chunks = outcomes.filter((o): o is ChunkTranscript => !!o && o !== 'skipped');
    const expected = outcomes.filter(o => o !== 'skipped').length;
    const picked = pickTranscript({ chunks, expected, browserText: browserTextRef.current });
    setPending(0);
    setPhase('idle');
    return { ...picked, durationSeconds };
  }, [release]);

  const reset = useCallback(() => {
    if (selfUrlRef.current) URL.revokeObjectURL(selfUrlRef.current);
    selfUrlRef.current = null;
    setSelfUrl(null);
    setError(null);
    setElapsed(0);
  }, []);

  return { phase, elapsed, level, pending, error, selfUrl, micLabel, supported, start, stop, reset };
}
