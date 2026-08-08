// Рендер текста, где `код в бэктиках` показывается моноширинным бейджем.
export function InlineCode({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="font-mono text-[13px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 rounded px-1 py-0.5"
          >
            {p}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
