// Разбивка произвольного текста на короткие фразы для чтения вслух.
// Режем по концам предложений (. ! ? …) и по разделителям внутри (; :),
// длинные предложения дополнительно дробим по запятым, чтобы фраза
// умещалась в один «глоток» распознавания речи.

const MAX_WORDS = 12;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function splitIntoPhrases(text: string): string[] {
  if (!text.trim()) return [];
  // границы предложений — сохраняем конечную пунктуацию
  const sentences = text
    .replace(/\s+/g, ' ')
    .match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [];

  const out: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (wordCount(sentence) <= MAX_WORDS) {
      out.push(sentence);
      continue;
    }
    // длинное предложение — дробим по ; : , сохраняя разделитель на конце куска
    const parts = sentence.split(/(?<=[;:,])\s+/);
    let buf = '';
    for (const part of parts) {
      const candidate = buf ? `${buf} ${part}` : part;
      if (wordCount(candidate) > MAX_WORDS && buf) {
        out.push(buf.trim());
        buf = part;
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  // финальная чистка: непустые, не длиннее разумного
  return out.map(s => s.trim()).filter(s => s.length > 0 && /[a-zà-öø-ÿœæ]/i.test(s));
}
