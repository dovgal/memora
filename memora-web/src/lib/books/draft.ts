// Черновик главы до отправки на сервер.

/**
 * Кусок главы. Сплошной текст остаётся основой — на нём держатся разбиение на
 * слова, озвучка и поиск, — а блоки добавляют то, без чего статья теряет
 * половину смысла: заголовки, списки и картинки.
 */
export type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'img'; src: string; alt: string };

/** Есть ли в блоке текст, который читают и переводят. */
export function isTextBlock(b: Block): b is Exclude<Block, { kind: 'img' }> {
  return b.kind !== 'img';
}

export interface ChapterDraft {
  title: string;
  content: string;
  /** Пусто — глава показывается сплошным текстом, как книга из файла. */
  blocks?: Block[];
}
