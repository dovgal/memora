"use client";

// Простой редактор кода для детей: моноширинный, с номерами строк и Tab = 4 пробела.
import { useRef } from "react";

export default function CodeEditor({
  value,
  onChange,
  language,
  minRows = 6,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  language: "python" | "sql";
  minRows?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lines = value.split("\n").length;
  const rows = Math.max(minRows, lines + 1);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + "    " + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      });
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-700 bg-[#111527] shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a2036] border-b border-zinc-700/60">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {language === "python" ? "🐍 Python" : "🐘 SQL · PostgreSQL"}
        </span>
        <span className="text-[11px] text-zinc-500">Tab = отступ</span>
      </div>
      <div className="flex">
        <div
          aria-hidden
          className="select-none text-right pr-2 pl-3 py-3 text-zinc-600 font-mono text-sm leading-6 bg-[#141931]"
        >
          {Array.from({ length: rows }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          // Без переноса длинных строк: иначе номера строк слева
          // разъезжаются с реальными строками кода.
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="flex-1 min-w-0 bg-transparent text-emerald-100 font-mono text-sm leading-6 p-3 pl-2 outline-none resize-none overflow-x-auto placeholder:text-zinc-600"
          placeholder={language === "python" ? "# пиши код здесь…" : "-- пиши запрос здесь…"}
        />
      </div>
    </div>
  );
}
