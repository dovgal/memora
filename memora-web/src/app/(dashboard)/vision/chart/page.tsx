'use client';
// Проверочная таблица для печати: Сивцева (буквы) и Орловой (картинки, для
// детей, которые ещё не читают).
//
// Размер знака рассчитывается, а не подбирается на глаз: оптотип должен быть
// виден под углом 5 угловых минут с расчётного расстояния. Отсюда высота
// h = 2·D·tg(2,5′) / V — она и подставляется в миллиметрах, поэтому при печати
// в масштабе 100 % таблица получается верной.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Printer, Eye } from 'lucide-react';

/** Строки таблицы Сивцева: острота зрения и знаки. */
const SIVTSEV: { v: number; row: string }[] = [
  { v: 0.1, row: 'Ш Б' },
  { v: 0.2, row: 'М Н К' },
  { v: 0.3, row: 'Ы М Б Ш' },
  { v: 0.4, row: 'Б Ы Н К М' },
  { v: 0.5, row: 'И Н Ш М К' },
  { v: 0.6, row: 'Н Ш Ы К Б' },
  { v: 0.7, row: 'Ш И Б М Н К' },
  { v: 0.8, row: 'Н К И Б М Ш Ы' },
  { v: 0.9, row: 'Б К Ш М И Н Ы' },
  { v: 1.0, row: 'Н М И К Б Ш Ы' },
  { v: 1.5, row: 'Ш Б М Н К Ы И' },
  { v: 2.0, row: 'Б М Ш Ы Н И К' },
];

/** Знаки таблицы Орловой — простые силуэты вместо букв. */
type Shape = 'star' | 'tree' | 'car' | 'plane' | 'mushroom' | 'duck' | 'ring';
const ORLOVA: { v: number; row: Shape[] }[] = [
  { v: 0.1, row: ['star', 'tree'] },
  { v: 0.2, row: ['car', 'plane', 'ring'] },
  { v: 0.3, row: ['mushroom', 'duck', 'star', 'tree'] },
  { v: 0.4, row: ['plane', 'ring', 'car', 'star', 'duck'] },
  { v: 0.5, row: ['tree', 'mushroom', 'plane', 'ring', 'car'] },
  { v: 0.6, row: ['duck', 'star', 'tree', 'car', 'plane'] },
  { v: 0.7, row: ['ring', 'car', 'mushroom', 'duck', 'star', 'tree'] },
  { v: 0.8, row: ['star', 'plane', 'ring', 'tree', 'car', 'duck'] },
  { v: 0.9, row: ['tree', 'duck', 'car', 'star', 'plane', 'mushroom'] },
  { v: 1.0, row: ['car', 'ring', 'star', 'duck', 'tree', 'plane', 'mushroom'] },
];

/** Силуэт в квадрате 10×10 — все знаки одной «оптической» высоты. */
function Optotype({ kind, size }: { kind: Shape; size: number }) {
  const p: Record<Shape, string> = {
    star: 'M5 0.4 6.3 3.6 9.7 3.8 7.1 6 8 9.4 5 7.5 2 9.4 2.9 6 0.3 3.8 3.7 3.6Z',
    tree: 'M5 0.4 8 4.4H6.4L9 8.3H1L3.6 4.4H2Z M4.2 8.3h1.6v1.3H4.2Z',
    car: 'M0.7 6.2 2 3.6h6l1.3 2.6v2H0.7Z M2.3 8.2a1 1 0 1 0 0.01 0Z M7.7 8.2a1 1 0 1 0 0.01 0Z',
    plane: 'M5 0.5 6 4h3.4L6.4 6l1 3.4L5 7.6 1.6 9.4l1-3.4L0.6 4H4Z',
    mushroom: 'M0.8 4.6C0.8 2.2 2.7 0.6 5 0.6s4.2 1.6 4.2 4H0.8Z M3.9 4.6h2.2v5H3.9Z',
    duck: 'M2 9.4c0-2.4 1.5-4 3.4-4V3.6c0-1.6 1-2.9 2.3-2.9 0.9 0 1.6 0.6 1.6 1.5 0 0.6-0.4 1-0.9 1h-0.6c0.6 1 0.9 2.2 0.9 3.3 0 1.8-1.4 2.9-3.4 2.9Z',
    ring: 'M5 0.6a4.4 4.4 0 1 1-0.01 0Z M5 3.1a1.9 1.9 0 1 0 0.01 0Z',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={p[kind]} fill="#000" fillRule="evenodd" />
    </svg>
  );
}

/** Высота знака в мм: 5 угловых минут с расстояния D для остроты V. */
function optotypeMm(distanceM: number, v: number): number {
  const D = distanceM * 1000;
  return (2 * D * Math.tan((5 / 60 / 2) * Math.PI / 180)) / v;
}

export default function VisionChartPage() {
  const [distance, setDistance] = useState(2.5);
  const [kind, setKind] = useState<'sivtsev' | 'orlova'>('sivtsev');

  const rows = kind === 'sivtsev' ? SIVTSEV : ORLOVA;

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <style>{`
        @media print {
          /* На печать уходит только сама таблица, в реальных миллиметрах. */
          body * { visibility: hidden; }
          #chart, #chart * { visibility: visible; }
          #chart { position: absolute; left: 0; top: 0; width: 210mm; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 print:hidden">
        <Link href="/vision" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-3">
          <ChevronLeft className="w-4 h-4" /> К тренажёру
        </Link>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 mb-2">
          <Eye className="w-7 h-7 text-[#4255ff]" /> Проверочная таблица для печати
        </h1>
        <p className="text-qz-text-muted mb-5 max-w-2xl">
          Размер знаков рассчитан по норме: знак виден под углом 5 угловых минут с указанного расстояния.
          Печатайте <strong>в масштабе 100 %</strong> — и обязательно проверьте линейкой контрольную линию.
        </p>

        <div className="flex flex-wrap gap-4 mb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-1.5">Расстояние</p>
            <div className="flex gap-2">
              {[2.5, 5].map(d => (
                <button key={d} onClick={() => setDistance(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    distance === d ? 'bg-[#4255ff] border-[#4255ff] text-white' : 'border-border text-qz-text-muted hover:border-[#4255ff]/50'}`}>
                  {d} м
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-1.5">Таблица</p>
            <div className="flex gap-2">
              <button onClick={() => setKind('sivtsev')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  kind === 'sivtsev' ? 'bg-[#4255ff] border-[#4255ff] text-white' : 'border-border text-qz-text-muted hover:border-[#4255ff]/50'}`}>
                Сивцева — буквы
              </button>
              <button onClick={() => setKind('orlova')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  kind === 'orlova' ? 'bg-[#4255ff] border-[#4255ff] text-white' : 'border-border text-qz-text-muted hover:border-[#4255ff]/50'}`}>
                Орловой — картинки
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={() => window.print()}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl transition-colors">
              <Printer className="w-4 h-4" /> Печать
            </button>
          </div>
        </div>

        <div className="border-l-4 border-amber-500 bg-amber-500/5 rounded-xl p-4 mb-6 text-sm text-qz-text-muted space-y-1.5">
          <p className="font-bold text-foreground">Как печатать и вешать</p>
          <p>• В окне печати выберите <strong>масштаб 100 %</strong>, снимите «по размеру страницы» / «Fit to page» — иначе размеры собьются.</p>
          <p>• Проверьте линейкой <strong>контрольную линию</strong> внизу листа: она должна быть ровно 100 мм.</p>
          <p>• Повесьте так, чтобы <strong>десятая строка была на уровне глаз</strong> ребёнка, и отойдите на {distance} м.</p>
          <p>• Освещение — равномерное, лист без бликов. Проверяют каждый глаз отдельно, прикрывая второй ладонью (не надавливая).</p>
          <p>• Для {distance === 5 ? 'пяти метров лист заполнен целиком — печатайте с минимальными полями' : 'малой комнаты 2,5 м достаточно; строка V=1,0 будет мелкой, это нормально'}.</p>
        </div>

        <p className="text-qz-text-muted text-xs mb-2">Предпросмотр (на экране размеры условные, точность даёт только печать):</p>
      </div>

      {/* Сама таблица — она же уходит на печать */}
      <div id="chart" style={{ background: '#fff', color: '#000', padding: '6mm 8mm', maxWidth: '210mm', margin: '0 auto' }}>
        <p style={{ textAlign: 'center', fontSize: '3.5mm', fontWeight: 700, margin: 0 }}>
          {kind === 'sivtsev' ? 'Таблица Сивцева' : 'Таблица Орловой (для детей)'} · расстояние {distance} м
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3mm' }}>
          <tbody>
            {rows.map((r, i) => {
              const mm = optotypeMm(distance, r.v);
              return (
                <tr key={r.v}>
                  <td style={{ width: '12mm', fontSize: '2.6mm', textAlign: 'right', paddingRight: '3mm', color: '#555' }}>
                    {i + 1}
                  </td>
                  <td style={{ textAlign: 'center', padding: '1.6mm 0' }}>
                    {kind === 'sivtsev' ? (
                      <span style={{
                        fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 700,
                        fontSize: `${mm}mm`, lineHeight: 1, letterSpacing: `${mm * 0.5}mm`,
                      }}>
                        {(r as { row: string }).row}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: `${mm * 0.5}mm`, alignItems: 'center' }}>
                        {(r as { row: Shape[] }).row.map((sh, k) => (
                          <Optotype key={k} kind={sh} size={mm * 3.7795} />
                        ))}
                      </span>
                    )}
                  </td>
                  <td style={{ width: '14mm', fontSize: '2.6mm', textAlign: 'left', paddingLeft: '3mm', color: '#555' }}>
                    V = {r.v.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Контрольная линия — проверка масштаба печати */}
        <div style={{ marginTop: '5mm', textAlign: 'center' }}>
          <div style={{ width: '100mm', height: '2mm', background: '#000', margin: '0 auto', position: 'relative' }} />
          <p style={{ fontSize: '2.8mm', marginTop: '1.5mm' }}>
            ↑ Эта линия должна быть ровно <strong>100 мм</strong>. Если нет — печать идёт с масштабированием, размеры знаков неверны.
          </p>
          <p style={{ fontSize: '2.4mm', color: '#666', marginTop: '1mm' }}>
            Таблица для домашних занятий и наблюдения за собой. Остроту зрения измеряет только офтальмолог.
          </p>
        </div>
      </div>
    </div>
  );
}
