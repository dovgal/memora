// Приблизительная транскрипция французского слова для СЛУХОВОГО сравнения.
//
// Зачем: распознавание речи возвращает орфографию, а проверяем мы произношение.
// Учащийся, сказавший [la mɛʁ], произнёс правильно — но движок мог записать
// «la mère», «la mer» или «la maire». Орфографическое сравнение засчитывало это
// как ошибку, хотя ошибки не было. Приводим обе стороны к фонетическому ключу:
// омофоны совпадают, а настоящее неверное произношение по-прежнему расходится.
//
// Это НЕ полноценный G2P: цель — свести к общему виду то, что звучит одинаково.
// Условные символы: U = [u] (ou), y = [y] (u), Ø = [ø/œ], E = [e/ɛ],
// Ã/Õ/Ẽ = носовые, S = [ʃ], Z = [ʒ], Ñ = [ɲ].

const NUMERALS: Record<string, string> = {
  '0': 'zero', '1': 'un', '2': 'deux', '3': 'trois', '4': 'quatre', '5': 'cinq',
  '6': 'six', '7': 'sept', '8': 'huit', '9': 'neuf', '10': 'dix', '11': 'onze',
  '12': 'douze', '13': 'treize', '14': 'quatorze', '15': 'quinze', '16': 'seize',
  '20': 'vingt', '30': 'trente', '40': 'quarante', '50': 'cinquante', '60': 'soixante',
  '100': 'cent', '1000': 'mille',
};

/**
 * Слова учёного происхождения, где gn читается РАЗДЕЛЬНО, как [ɡn]:
 * cognition = [kɔɡnisjɔ̃], а не [kɔɲisjɔ̃]. Без этого списка проверка
 * засчитывала бы правильное [ɡn] как ошибку и наоборот.
 */
const GN_SEPARATE = /^(cogn|diagn|stagn|gnom|gnos|agnos|wagn|magnum|igné)/;

/** Слова, где конечная согласная вопреки правилу звучит. */
const FINAL_SOUNDS = new Set(['six', 'dix', 'sud', 'ours', 'fils', 'sens', 'mars', 'bus', 'plus']);

export function phoneticKey(raw: string): string {
  let w = (raw || '').toLowerCase().trim();
  if (!w) return '';

  // Цифры от распознавания → слова: «trois» ↔ «3».
  if (NUMERALS[w]) w = NUMERALS[w];

  w = w.replace(/['’]/g, '');          // элизия: l'eau → leau
  w = w.replace(/[^a-zà-ÿœ]/g, '');
  if (!w) return '';

  // Конечное -er/-ez в длинных словах = [e]: parler ↔ parlé, allez ↔ allé.
  // Порог в три знака до окончания оставляет односложные mer, cher, fier как [ɛʁ].
  w = w.replace(/(?<=.{3,})(er|ez)$/, 'é');
  // 1. Немые конечные согласные — правило орфографическое, поэтому снимаем ДО
  //    остальных замен и по циклу: -gt (vingt), -ts, -ds, -nt дают по два знака.
  //    Читаются обычно c, r, f, l (мнемоника CaReFuL) — их не трогаем.
  if (!FINAL_SOUNDS.has(w)) {
    // Порог 1, а не 2: служебные слова тоже дочищаются (est → es → e = [ɛ]).
    while (w.length > 1 && /[stdxzpg]$/.test(w)) w = w.slice(0, -1);
  }

  // 2. Смягчение c/g — ДО назализации, пока e/i/y ещё на месте.
  w = w.replace(/gu([eiy])/g, 'g$1');
  w = w.replace(/qu/g, 'k').replace(/q/g, 'k');
  w = w.replace(/c([eiyéèê])/g, 's$1');
  w = w.replace(/ç/g, 's');
  w = w.replace(/g([eiyéèê])/g, 'Z$1');
  w = w.replace(/j/g, 'Z');

  // 3. Диграфы согласных. В учёных словах gn — это [ɡ]+[n], а не [ɲ]:
  //    прячем такую пару под G, чтобы общее правило её не съело.
  if (GN_SEPARATE.test(w)) w = w.replace(/gn/g, 'Gn');
  w = w.replace(/ch/g, 'S').replace(/ph/g, 'f').replace(/gn/g, 'Ñ').replace(/th/g, 't');
  w = w.replace(/G/g, 'g');
  w = w.replace(/x/g, 'ks').replace(/h/g, '');

  // 4. Носовые: гласный + n/m, если дальше не гласная и не та же согласная.
  const V = 'aeiouyœéèêëàâôöûùüîï';
  w = w.replace(new RegExp(`(ain|aim|ein|eim|in|im|yn|ym)(?![${V}nm])`, 'g'), 'Ẽ');
  w = w.replace(new RegExp(`(oin)(?![${V}nm])`, 'g'), 'wẼ');
  w = w.replace(new RegExp(`(an|am|en|em)(?![${V}nm])`, 'g'), 'Ã');
  w = w.replace(new RegExp(`(on|om)(?![${V}nm])`, 'g'), 'Õ');
  w = w.replace(new RegExp(`(un|um)(?![${V}nm])`, 'g'), 'Ẽ'); // brun/brin в речи совпадают

  // Немое конечное -e — ПОСЛЕ назализации: иначе «une» превратилась бы в «un»
  // и дала ложный носовой (une [yn] ≠ un [œ̃], plaine [plɛn] ≠ plein [plɛ̃]).
  if (w.length > 2) w = w.replace(/e$/, '');

  // 5. Гласные диграфы. ou → U (а не u!), иначе следующий шаг u → y
  //    склеил бы rousse и russe — ровно ту пару, которую курс и различает.
  w = w.replace(/eau|au/g, 'o');
  w = w.replace(/ou|où|oû/g, 'U');
  w = w.replace(/oi|oy/g, 'wa');
  w = w.replace(/ai|aî|ei|ay/g, 'E');
  w = w.replace(/eu|œu|oeu|œ/g, 'Ø');
  w = w.replace(/ui/g, 'ɥi');

  // 6. s между гласными звучит как z (poisson ↔ poison).
  w = w.replace(new RegExp(`([${V}EØÃÕẼU])s([${V}EØÃÕẼU])`, 'g'), '$1z$2');

  // 7. Одиночные гласные и акценты.
  w = w.replace(/[éèêë]/g, 'E').replace(/[àâ]/g, 'a').replace(/[ôö]/g, 'o');
  w = w.replace(/[ûùü]/g, 'y').replace(/[îï]/g, 'i');
  w = w.replace(/u/g, 'y');           // французское u = [y]; ou уже стало U
  w = w.replace(/c/g, 'k').replace(/g/g, 'g');

  // 8. Удвоенные согласные звучат как одинарные.
  w = w.replace(/([bcdfgklmnprstvzZSÑ])\1+/g, '$1');

  // 9. Оставшееся безакцентное e приравниваем к E: движок часто путает e/é/è.
  w = w.replace(/e/g, 'E');

  return w;
}

/** Звучат ли два слова одинаково (с точностью до приближения). */
export function soundsSame(a: string, b: string): boolean {
  const ka = phoneticKey(a), kb = phoneticKey(b);
  return ka.length > 0 && ka === kb;
}
