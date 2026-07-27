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
import { getSpeechRecognition, hasMediaDevices, type SpeechRecognitionLike } from '@/lib/speech';

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
  /** Сбросить запись перед новой попыткой. */
  reset: () => void;
}

export function useSpeechAttempt(speechLang = 'fr-FR'): SpeechAttempt {
  const [recording, setRecording] = useState(false);
  const [selfUrl, setSelfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  const sessionBaseRef = useRef('');
  const recordingRef = useRef(false);

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
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      setError(name === 'NotFoundError' || name === 'DevicesNotFoundError'
        ? 'Микрофон не найден. Проверьте, что он подключён и выбран в системе.'
        : 'Доступ к микрофону не выдан. Нажмите «Разрешить» в запросе браузера, а если запроса нет — откройте настройки сайта (значок слева в адресной строке) и включите микрофон.');
      return;
    }
    streamRef.current = stream;

    chunksRef.current = [];
    try {
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = ev => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        if (blob.size > 0) setSelfUrl(URL.createObjectURL(blob));
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
          const results = event.results;
          for (let i = 0; i < results.length; i++) full += (results[i]?.[0]?.transcript ?? '') + ' ';
          transcriptRef.current = `${sessionBaseRef.current} ${full}`.trim();
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
    return transcriptRef.current.trim();
  }, []);

  return { recording, selfUrl, error, setError, recorderSupported, speechSupported, start, stop, reset };
}
