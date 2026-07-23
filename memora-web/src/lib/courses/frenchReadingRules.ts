// База правил чтения французского языка для тренажёра чтения вслух.
// Каждое правило: как пишется → как звучит → объяснение по-русски.
// rulesForWord(word) подбирает правила, задействованные в конкретном слове, —
// так ошибочно прочитанное слово аннотируется нужными правилами.

export interface ReadingRule {
  id: string;
  /** Буквосочетание/буква, как показывается ученику. */
  spelling: string;
  /** Звук в МФА. */
  sound: string;
  /** Регулярка по слову (без учёта регистра). */
  pattern: RegExp;
  /** Короткое объяснение правила по-русски. */
  explanation: string;
  /** Пример: слово → транскрипция. */
  example: string;
}

// Порядок имеет значение только для показа; матчинг — по всем правилам.
export const READING_RULES: ReadingRule[] = [
  // ---- гласные и диграфы ----
  { id: 'eau', spelling: 'eau / au', sound: '[o]', pattern: /eau|au(?!x?[aeiouy])/i,
    explanation: 'Сочетания au и eau всегда читаются как один закрытый звук [o].',
    example: 'bateau → [bato], jaune → [ʒon]' },
  { id: 'ou', spelling: 'ou', sound: '[u]', pattern: /ou(?![aeéèiy])/i,
    explanation: 'ou читается как русское «у»: [u]. Не путать с u = [y].',
    example: 'rouge → [ʁuʒ], toujours → [tuʒuʁ]' },
  { id: 'u', spelling: 'u', sound: '[y]', pattern: /(?<![aoeqg])u(?![aeiouxmn])/i,
    explanation: 'Одиночная u — огублённый [y]: губы как для «у», язык как для «и». Русского аналога нет.',
    example: 'tu → [ty], rue → [ʁy]' },
  { id: 'oi', spelling: 'oi', sound: '[wa]', pattern: /oi(?!n)/i,
    explanation: 'oi читается [wa], а не «ой».',
    example: 'moi → [mwa], trois → [tʁwa]' },
  { id: 'ui', spelling: 'ui', sound: '[ɥi]', pattern: /ui/i,
    explanation: 'ui — полугласный [ɥ] + [i]: быстро скользим от [y] к [i].',
    example: 'huit → [ɥit], la nuit → [nɥi]' },
  { id: 'eu', spelling: 'eu / œu', sound: '[ø]/[œ]', pattern: /eu|œu/i,
    explanation: 'eu/œu: в конце слова или перед немой согласной — закрытый [ø] (deux), перед звучащей — открытый [œ] (sœur).',
    example: 'deux → [dø], fleur → [flœʁ]' },
  { id: 'e-acute', spelling: 'é', sound: '[e]', pattern: /é/,
    explanation: 'é (accent aigu) — закрытый [e]: рот почти закрыт, губы в улыбке.',
    example: 'été → [ete], café → [kafe]' },
  { id: 'e-grave', spelling: 'è / ê / ai / ei', sound: '[ɛ]', pattern: /è|ê|ai(?![lm])|ei(?!n)/i,
    explanation: 'è, ê и сочетания ai/ei — открытый [ɛ], как «э» в «этот».',
    example: 'mère → [mɛʁ], fête → [fɛt], lait → [lɛ]' },
  { id: 'er-ez', spelling: '-er / -ez (в конце)', sound: '[e]', pattern: /(er|ez)$/i,
    explanation: 'Конечные -er (инфинитив) и -ez (вы-форма) читаются [e]; r и z немые.',
    example: 'parler → [paʁle], allez → [ale]' },
  { id: 'e-caduc', spelling: 'e без акцента', sound: '[ə]', pattern: /^[djlmnst]e$|(?<=[^aeiouéèê])e(?=[^aeiouénst]|$)/i,
    explanation: 'Безударное e без акцента — беглое [ə] (le, je); в конце слова — немое.',
    example: 'le petit → [lə pəti]' },
  { id: 'final-e', spelling: '-e на конце', sound: 'немое', pattern: /[^é]e$/i,
    explanation: 'Конечное -e без акцента не читается; предыдущая согласная звучит.',
    example: 'parle → [paʁl], table → [tabl]' },
  // ---- носовые ----
  { id: 'nasal-an', spelling: 'an / am / en / em', sound: '[ɑ̃]', pattern: /(an|am|en|em)(?![aeiouynm])|(an|en)$/i,
    explanation: 'Гласный + n/m в одном слоге = носовой [ɑ̃]; сама n/m не звучит.',
    example: 'grand → [ɡʁɑ̃], enfant → [ɑ̃fɑ̃]' },
  { id: 'nasal-on', spelling: 'on / om', sound: '[ɔ̃]', pattern: /(on|om)(?![aeiouynm])|on$/i,
    explanation: 'on/om — носовой [ɔ̃].',
    example: 'bon → [bɔ̃], maison → [mɛzɔ̃]' },
  { id: 'nasal-in', spelling: 'in / im / ain / ein / un', sound: '[ɛ̃]', pattern: /(in|im|ain|ein|un)(?![aeiouynm])|(in|ain|un)$/i,
    explanation: 'in/im/ain/ein/un — носовой [ɛ̃].',
    example: 'vin → [vɛ̃], pain → [pɛ̃], un → [œ̃]' },
  { id: 'denasal', spelling: 'гласн.+nn / +гласная', sound: 'чистый + [n]',
    pattern: /(o|a|u|ai|ei)nn|[aeiou]n[aeiouy]/i,
    explanation: 'Перед второй n/m или гласной назальность пропадает: n звучит, гласный чистый.',
    example: 'bonne → [bɔn], année → [ane]' },
  // ---- согласные ----
  { id: 'ch', spelling: 'ch', sound: '[ʃ]', pattern: /ch/i,
    explanation: 'ch читается [ʃ] (как «ш»), а не «ч» и не «к».',
    example: 'chat → [ʃa], chance → [ʃɑ̃s]' },
  { id: 'j-ge', spelling: 'j / g+e,i,y', sound: '[ʒ]', pattern: /j|g[eiyéè]/i,
    explanation: 'j всегда [ʒ] («ж»); g перед e/i/y — тоже [ʒ]. Перед a/o/u g = [ɡ].',
    example: 'jour → [ʒuʁ], girafe → [ʒiʁaf]' },
  { id: 'gn', spelling: 'gn', sound: '[ɲ]', pattern: /gn/i,
    explanation: 'gn — мягкое [ɲ] («нь»).',
    example: 'montagne → [mɔ̃taɲ], Espagne → [ɛspaɲ]' },
  { id: 'c-soft', spelling: 'c+e,i / ç', sound: '[s]', pattern: /c[eiyéè]|ç/i,
    explanation: 'c перед e/i/y и ç читаются [s]. Перед a/o/u обычная c = [k].',
    example: 'cinéma → [sinema], garçon → [ɡaʁsɔ̃]' },
  { id: 'c-hard', spelling: 'c+a,o,u', sound: '[k]', pattern: /c[aou](?!$)/i,
    explanation: 'c перед a/o/u читается [k].',
    example: 'café → [kafe], école → [ekɔl]' },
  { id: 'qu', spelling: 'qu', sound: '[k]', pattern: /qu/i,
    explanation: 'qu — просто [k]; u после q не читается.',
    example: 'musique → [myzik], qui → [ki]' },
  { id: 's-z', spelling: 'одна s между гласными', sound: '[z]', pattern: /[aeiouéèêy]s[aeiouéèêy]/i,
    explanation: 'Одна s между гласными озвончается в [z]. Для звука [s] пишут ss.',
    example: 'maison → [mɛzɔ̃], poison → [pwazɔ̃]' },
  { id: 'ss', spelling: 'ss', sound: '[s]', pattern: /ss/i,
    explanation: 'Двойная ss между гласными сохраняет глухой [s].',
    example: 'poisson → [pwasɔ̃], classe → [klas]' },
  { id: 'h-mute', spelling: 'h', sound: 'немая', pattern: /h/i,
    explanation: 'h во французском никогда не произносится.',
    example: 'homme → [ɔm], heure → [œʁ]' },
  { id: 'ph', spelling: 'ph', sound: '[f]', pattern: /ph/i,
    explanation: 'ph читается [f].',
    example: 'photo → [fɔto], pharmacie → [faʁmasi]' },
  { id: 'ill', spelling: 'ill / -il', sound: '[j]', pattern: /ill|[aeou]il$/i,
    explanation: 'ill и конечное -il после гласной дают [j] («й»). Исключения: ville, mille — [l].',
    example: 'famille → [famij], soleil → [sɔlɛj]' },
  { id: 'tion', spelling: '-tion', sound: '[sjɔ̃]', pattern: /tion/i,
    explanation: 'Окончание -tion читается [sjɔ̃]: t превращается в [s].',
    example: 'nation → [nasjɔ̃], addition → [adisjɔ̃]' },
  { id: 'r', spelling: 'r', sound: '[ʁ]', pattern: /r/i,
    explanation: 'Французское r — увулярное [ʁ], «в горле», мягче русского раскатистого [р].',
    example: 'rue → [ʁy], Paris → [paʁi]' },
  { id: 'final-cons', spelling: 'конечные согласные', sound: 'обычно немые',
    pattern: /[dtpsxzg]s?$/i,
    explanation: 'Финальные согласные чаще всего не читаются. Обычно читаются c, r, f, l (слово CaReFuL).',
    example: 'grand → [ɡʁɑ̃], trois → [tʁwa], но mer → [mɛʁ]' },
  { id: 'ent-verb', spelling: '-ent (глагол)', sound: 'немое', pattern: /ent$/i,
    explanation: 'Глагольное окончание -ent (ils parlent) полностью немое.',
    example: 'ils parlent → [il paʁl]' },
  { id: 'oin', spelling: 'oin', sound: '[wɛ̃]', pattern: /oin/i,
    explanation: 'oin — [w] + носовой [ɛ̃].',
    example: 'loin → [lwɛ̃], moins → [mwɛ̃]' },
  { id: 'ien', spelling: 'ien', sound: '[jɛ̃]', pattern: /ien(?![aeiouynt])|ien$/i,
    explanation: 'ien — [j] + носовой [ɛ̃].',
    example: 'bien → [bjɛ̃], chien → [ʃjɛ̃]' },
  { id: 'x', spelling: 'x', sound: '[ks]/[ɡz]/немая', pattern: /x/i,
    explanation: 'x: в начале ex+гласная — [ɡz] (examen), иначе [ks] (taxi); на конце слова обычно немая (deux, prix).',
    example: 'examen → [ɛɡzamɛ̃], deux → [dø]' },
  { id: 'y', spelling: 'y', sound: '[i]/[j]', pattern: /y/i,
    explanation: 'y между согласными — [i]; рядом с гласной — [j]. Звука «ы» во французском нет.',
    example: 'style → [stil], yeux → [jø]' },
];

/** Правила, задействованные в написании слова (для аннотации ошибок чтения). */
export function rulesForWord(word: string): ReadingRule[] {
  const w = word.toLowerCase().replace(/^[^a-zàâäéèêëîïôöùûüçœæ']+|[^a-zàâäéèêëîïôöùûüçœæ']+$/gi, '');
  if (!w) return [];
  return READING_RULES.filter(r => r.pattern.test(w));
}
