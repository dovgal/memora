// Полный инвентарь звуков французского языка для звуковой таблицы.
// Каждый звук: символ МФА, слово-пример (озвучивается через TTS), варианты
// написания и короткая подсказка. Кнопка проигрывает слово-пример.

export interface FrenchSound {
  ipa: string;          // символ МФА, напр. [ɛ̃]
  example: string;      // слово-пример для озвучки
  exampleIpa: string;   // транскрипция примера
  spellings: string;    // как записывается
  note: string;         // короткая подсказка по-русски
}

export interface SoundGroup {
  title: string;
  sounds: FrenchSound[];
}

export const FRENCH_SOUNDS: SoundGroup[] = [
  {
    title: 'Гласные',
    sounds: [
      { ipa: 'a', example: 'la table', exampleIpa: 'la tabl', spellings: 'a, à, â', note: 'чёткое «а», не редуцируется' },
      { ipa: 'i', example: 'la vie', exampleIpa: 'la vi', spellings: 'i, î, y', note: 'чистое «и»' },
      { ipa: 'y', example: 'la rue', exampleIpa: 'la ʁy', spellings: 'u, û', note: 'губы «у», язык «и» — нет в русском' },
      { ipa: 'u', example: 'rouge', exampleIpa: 'ʁuʒ', spellings: 'ou, où, oû', note: 'русское «у»' },
      { ipa: 'e', example: 'l\'été', exampleIpa: 'lete', spellings: 'é, -er, -ez, les', note: 'закрытое «е», рот почти закрыт' },
      { ipa: 'ɛ', example: 'la mère', exampleIpa: 'la mɛʁ', spellings: 'è, ê, ai, ei', note: 'открытое «э», рот шире' },
      { ipa: 'ə', example: 'le petit', exampleIpa: 'lə pəti', spellings: 'e без акцента', note: 'беглое e, в речи выпадает' },
      { ipa: 'o', example: 'le bateau', exampleIpa: 'lə bato', spellings: 'o, ô, au, eau', note: 'закрытое «о»' },
      { ipa: 'ɔ', example: 'la porte', exampleIpa: 'la pɔʁt', spellings: 'o в закрытом слоге', note: 'открытое «о»' },
      { ipa: 'ø', example: 'deux', exampleIpa: 'dø', spellings: 'eu, œu (в конце)', note: 'закрытое, губы трубочкой' },
      { ipa: 'œ', example: 'la fleur', exampleIpa: 'la flœʁ', spellings: 'eu, œu (перед согл.)', note: 'открытое eu' },
    ],
  },
  {
    title: 'Носовые гласные',
    sounds: [
      { ipa: 'ɑ̃', example: 'grand', exampleIpa: 'ɡʁɑ̃', spellings: 'an, am, en, em', note: 'открытое «ан» в нос' },
      { ipa: 'ɔ̃', example: 'bon', exampleIpa: 'bɔ̃', spellings: 'on, om', note: 'округлое «он» в нос' },
      { ipa: 'ɛ̃', example: 'le vin', exampleIpa: 'lə vɛ̃', spellings: 'in, im, ain, ein, un', note: '«эн» в нос' },
    ],
  },
  {
    title: 'Полугласные',
    sounds: [
      { ipa: 'j', example: 'les yeux', exampleIpa: 'le zjø', spellings: 'i/y+гл., -il, -ill', note: 'как «й»' },
      { ipa: 'w', example: 'oui', exampleIpa: 'wi', spellings: 'ou+гл., oi=[wa]', note: 'как «у» в «уа»' },
      { ipa: 'ɥ', example: 'huit', exampleIpa: 'ɥit', spellings: 'u+гласная', note: 'быстрое [y]→[i], нет в русском' },
    ],
  },
  {
    title: 'Согласные',
    sounds: [
      { ipa: 'p', example: 'le pain', exampleIpa: 'lə pɛ̃', spellings: 'p, pp', note: 'без придыхания' },
      { ipa: 'b', example: 'bon', exampleIpa: 'bɔ̃', spellings: 'b, bb', note: 'звонкий' },
      { ipa: 't', example: 'la table', exampleIpa: 'la tabl', spellings: 't, tt, th', note: 'без придыхания' },
      { ipa: 'd', example: 'deux', exampleIpa: 'dø', spellings: 'd, dd', note: 'звонкий, не оглушается на конце' },
      { ipa: 'k', example: 'le café', exampleIpa: 'lə kafe', spellings: 'c(+a/o/u), qu, k, ch(греч.)', note: 'без придыхания' },
      { ipa: 'ɡ', example: 'la gare', exampleIpa: 'la ɡaʁ', spellings: 'g(+a/o/u), gu(+e/i)', note: 'звонкий' },
      { ipa: 'f', example: 'la fille', exampleIpa: 'la fij', spellings: 'f, ff, ph', note: 'глухой' },
      { ipa: 'v', example: 'la vie', exampleIpa: 'la vi', spellings: 'v, w(редко)', note: 'звонкий' },
      { ipa: 's', example: 'le sac', exampleIpa: 'lə sak', spellings: 's, ss, c(+e/i), ç, -tion', note: 'глухой' },
      { ipa: 'z', example: 'la maison', exampleIpa: 'la mɛzɔ̃', spellings: 's между гласными, z', note: 'звонкий' },
      { ipa: 'ʃ', example: 'le chat', exampleIpa: 'lə ʃa', spellings: 'ch', note: 'как «ш» (не «ч»)' },
      { ipa: 'ʒ', example: 'le jour', exampleIpa: 'lə ʒuʁ', spellings: 'j, g(+e/i/y)', note: 'как «ж»' },
      { ipa: 'm', example: 'la mer', exampleIpa: 'la mɛʁ', spellings: 'm, mm', note: 'носовая согласная' },
      { ipa: 'n', example: 'la nuit', exampleIpa: 'la nɥi', spellings: 'n, nn', note: 'носовая согласная' },
      { ipa: 'ɲ', example: 'la montagne', exampleIpa: 'la mɔ̃taɲ', spellings: 'gn', note: 'мягкое «нь»' },
      { ipa: 'l', example: 'le lit', exampleIpa: 'lə li', spellings: 'l, ll', note: 'светлое «л»' },
      { ipa: 'ʁ', example: 'Paris', exampleIpa: 'paʁi', spellings: 'r, rr', note: 'увулярное «в горле»' },
    ],
  },
];
