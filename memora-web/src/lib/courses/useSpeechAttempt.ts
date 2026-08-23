'use client';
// Общий хук записи попытки произношения: микрофон + распознавание речи.
//
// Извлечён из LectureTrainer, чтобы фонетический коуч не дублировал тонкости,
// которые дались опытом:
//  • MediaRecorder запускается всегда — он надёжно вызывает системный запрос
//    доступа и даёт запись «прослушать себя» даже там, где облачный STT молчит;
//  • распознавание идёт в continuous-режиме, вердикт — только по ручной
//    остановке, иначе движок обрывает на первой паузе;
//  • при авто-перезапуске STT нумерация results обнуляется, поэтому накопленный
//    текст фиксируется в базе и склеивается, иначе речь до паузы теряется.

import { useCallback, useRef, useState } from 'react';
import { getSession } from 'next-auth/react';
import {
  getSpeechRecognition, hasMediaDevices, chooseMic, listMicrophones, micLabelOf, looksExternal,
  type SpeechRecognitionLike,
} from '@/lib/speech';

/**
 * Состояние серверного распознавания на всё приложение: 'off' ставится только
 * при явном «не настроено» (503), чтобы не ждать впустую на каждой попытке.
 * Временная недоступность сервиса такого решения не заслуживает.
 */
let serverStt: 'unknown' | 'ok' | 'off' = 'unknown';

/**
 * Распознать запись на своём сервисе (faster-whisper). Возвращает пустую
 * строку, если не вышло, — вызывающий откатится на браузерное распознавание.
 */
async function transcribeOnServer(blob: Blob, speechLang: string): Promise<string> {
  if (serverStt === 'off') return '';
  try {
    const session = await getSession();
    const token = (session as { id_token?: string } | null)?.id_token;
    const res = await fetch(`/api/audio/transcribe?language=${encodeURIComponent(speechLang.slice(0, 2))}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: blob,
    });
    if (res.status === 503) { serverStt = 'off'; return ''; }
    if (!res.ok) return '';
    const data = await res.json();
    serverStt = 'ok';
    return typeof data?.text === 'string' ? data.text.trim() : '';
  } catch {
    return '';
  }
}

export interface SpeechAttempt {
  /** Идёт ли запись прямо сейчас. */
  recording: boolean;
  /** Ссылка на запись голоса ученика (для «прослушать себя»). */
  selfUrl: string | null;
  /** Текст ошибки доступа/поддержки, если есть. */
  error: string | null;
  setError: (e: string | null) => void;
  recorderSupported: boolean;
  speechSupported: boolean;
  /** Начать запись. */
  start: () => Promise<void>;
  /** Остановить и получить распознанный текст (пустая строка — не распознано). */
  stop: () => Promise<string>;
  /** Альтернативные гипотезы движка по сегментам — для выбора лучшей по эталону. */
  alternatives: () => string[][];
  /** Сбросить запись перед новой попыткой. */
  reset: () => void;
  /** Микрофон, с которого ведётся ЗАПИСЬ (мы его выбираем сами). */
  micLabel: string | null;
  /**
   * Устройство по умолчанию в браузере — именно с него идёт РАСПОЗНАВАНИЕ.
   * Выбрать его страница не может: в Web Speech API такого метода нет.
   */
  defaultMicLabel: string | null;
  /** Похоже ли устройство по умолчанию на наушники: повод предупредить. */
  defaultIsExternal: boolean;
  /** Идёт распознавание записи на сервере. */
  transcribing: boolean;
  /** Кто дал вердикт: наш сервис или движок браузера. */
  lastEngine: 'server' | 'browser' | null;
}

export function useSpeechAttempt(speechLang = 'fr-FR'): SpeechAttempt {
  const [recording, setRecording] = useState(false);
  const [selfUrl, setSelfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micLabel, setMicLabel] = useState<string | null>(null);
  const [defaultMicLabel, setDefaultMicLabel] = useState<string | null>(null);
  const [defaultIsExternal, setDefaultIsExternal] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [lastEngine, setLastEngine] = useState<'server' | 'browser' | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  const altsRef = useRef<string[][]>([]);
  const sessionBaseRef = useRef('');
  const recordingRef = useRef(false);
  /** Готовая запись: MediaRecorder отдаёт её только в onstop, поэтому ждём обещание. */
  const blobRef = useRef<Promise<Blob | null> | null>(null);
  const blobResolveRef = useRef<((b: Blob | null) => void) | null>(null);

  const recorderSupported = hasMediaDevices() && typeof window !== 'undefined' && 'MediaRecorder' in window;
  const speechSupported = !!getSpeechRecognition();

  const reset = useCallback(() => {
    setSelfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setError(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setSelfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (!recorderSupported) { setError('Этот браузер не поддерживает запись с микрофона.'); return; }

    let stream: MediaStream;
    try {
      // Первый заход — с устройством по умолчанию: он же и выдаёт разрешение,
      // без которого названия микрофонов недоступны.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mics = await listMicrophones();
      const current = stream.getAudioTracks()[0]?.getSettings().deviceId;
      const currentLabel = micLabelOf(mics, current);
      setDefaultMicLabel(currentLabel || null);
      setDefaultIsExternal(!!currentLabel && looksExternal(currentLabel));

      // Перецепляемся на встроенный микрофон, если по умолчанию стоит другой.
      const wanted = await chooseMic();
      if (wanted && current && wanted.deviceId !== current) {
        stream.getTracks().forEach(t => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: wanted.deviceId } },
        });
      }
      setMicLabel(wanted?.label ?? currentLabel ?? null);
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      setError(name === 'NotFoundError' || name === 'DevicesNotFoundError'
        ? 'Микрофон не найден. Проверьте, что он подключён и выбран в системе.'
        : 'Доступ к микрофону не выдан. Нажмите «Разрешить» в запросе браузера, а если запроса нет — откройте настройки сайта (значок слева в адресной строке) и включите микрофон.');
      return;
    }
    streamRef.current = stream;

    chunksRef.current = [];
    blobRef.current = new Promise<Blob | null>(resolve => { blobResolveRef.current = resolve; });
    try {
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        if (blob.size > 0) setSelfUrl(URL.createObjectURL(blob));
        blobResolveRef.current?.(blob.size > 0 ? blob : null);
        blobResolveRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
      mediaRecRef.current = mr;
      mr.start();
    } catch {
      stream.getTracks().forEach(t => t.stop());
      setError('Не удалось начать запись. Попробуйте Chrome или Safari.');
      return;
    }

    transcriptRef.current = '';
    sessionBaseRef.current = '';
    altsRef.current = [];
    const SR = getSpeechRecognition();
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = speechLang;
        rec.interimResults = false;
        rec.continuous = true;
        // Просим несколько гипотез: движок часто ставит верный вариант вторым
        // или третьим. Лучшую из них выбирает вызывающий — он знает эталон.
        rec.maxAlternatives = 5;
        rec.onresult = event => {
          let full = '';
          const results = event.results;
          const alts: string[][] = [];
          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            full += (r?.[0]?.transcript ?? '') + ' ';
            const seg: string[] = [];
            for (let a = 0; a < (r?.length ?? 0); a++) {
              const t = r[a]?.transcript;
              if (t) seg.push(t);
            }
            alts.push(seg);
          }
          transcriptRef.current = `${sessionBaseRef.current} ${full}`.trim();
          altsRef.current = alts;
        };
        rec.onend = () => {
          if (recordingRef.current) {
            sessionBaseRef.current = transcriptRef.current;
            try { rec.start(); } catch { /* noop */ }
          }
        };
        rec.onerror = () => {};
        recognitionRef.current = rec;
        rec.start();
      } catch { /* распознавание недоступно — останется запись */ }
    }

    recordingRef.current = true;
    setRecording(true);
  }, [recorderSupported, speechLang]);

  const stop = useCallback(async (): Promise<string> => {
    recordingRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    try { mediaRecRef.current?.stop(); } catch { /* noop */ }
    setRecording(false);
    // Даём движку время отдать финальные сегменты.
    await new Promise(r => setTimeout(r, 1200));
    const browserText = transcriptRef.current.trim();

    // Своё распознавание точнее и, главное, слушает выбранный НАМИ микрофон.
    // Браузерный движок остаётся страховкой: сервис может быть не настроен,
    // не подняться после передеплоя или не успеть ответить.
    const blob = await Promise.race([
      blobRef.current ?? Promise.resolve(null),
      new Promise<Blob | null>(r => setTimeout(() => r(null), 3000)),
    ]);
    if (blob) {
      setTranscribing(true);
      const serverText = await transcribeOnServer(blob, speechLang);
      setTranscribing(false);
      if (serverText) {
        setLastEngine('server');
        return serverText;
      }
    }
    setLastEngine(browserText ? 'browser' : null);
    return browserText;
  }, [speechLang]);

  const alternatives = useCallback(() => altsRef.current, []);

  return {
    recording, selfUrl, error, setError, recorderSupported, speechSupported,
    start, stop, alternatives, reset,
    micLabel, defaultMicLabel, defaultIsExternal, transcribing, lastEngine,
  };
}
