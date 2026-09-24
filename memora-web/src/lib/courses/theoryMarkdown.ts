// Теория в курсах бывает двух видов: HTML (кодовые курсы) и простой текст с
// разметкой **жирный** и переносами строк (курсы из базы, юниты от ИИ — в
// запросе к модели так и написано: «можно **markdown**»). Компонент теории
// выводит HTML как есть, поэтому второй вид показывался со звёздочками и одним
// сплошным абзацем. Здесь он превращается в HTML; готовый HTML не трогаем.

const HTML_TAG = /<\/?(p|div|b|strong|em|i|br|ul|ol|li|table|tr|td|th|span|h[1-6])\b/i;

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    // Одиночные звёздочки — курсив, но не «*» посреди слова и не маркер списка.
    .replace(/(^|[\s(«])\*(?!\s)([^*]+?)\*(?=[\s).,:;!?»]|$)/g, '$1<i>$2</i>');
}

const BULLET = /^\s*(?:[-•—]|\*(?=\s))\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export function theoryToHtml(content: string): string {
  if (!content) return '';
  if (HTML_TAG.test(content)) return content;

  const out: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p style="margin:0.6rem 0">${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const style = list.tag === 'ul' ? 'margin:0.4rem 0 0.6rem 1.2rem;list-style:disc' : 'margin:0.4rem 0 0.6rem 1.2rem;list-style:decimal';
      out.push(`<${list.tag} style="${style}">${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
    }
    list = null;
  };

  for (const raw of content.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    const kind: 'ul' | 'ol' | null = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null;
    if (kind) {
      flushPara();
      if (!list || list.tag !== kind) { flushList(); list = { tag: kind, items: [] }; }
      list.items.push(line.replace(kind === 'ul' ? BULLET : NUMBERED, ''));
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out.join('');
}
