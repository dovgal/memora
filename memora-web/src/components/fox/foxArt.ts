// Рисунок лисёнка: три позы (стоит, сидит, клубок) и накладки (искорки, «z»,
// звуковые волны). Какие части видны и что движется — решают классы на <svg>
// (см. раздел .mfx в globals.css), поэтому разметка собирается один раз.
//
// Строка статична и не содержит пользовательского текста — её безопасно
// вставлять как innerHTML.

const O = '#EE8434';
const OD = '#D46A22';
const W = '#FFF4E6';
const D = '#3A2A22';
const PW = '#4A3024';
const BL = '#3F6FE0';
const PK = '#F4A3A8';

const head = () => `<g class="ears"><path d="M106 40 L103 19 L118 33 Z" fill="${OD}"/><path d="M115 36 L123 16 L131 37 Z" fill="${O}"/><path d="M118 34 L122 22 L127 35 Z" fill="${D}" opacity=".3"/></g>
<ellipse cx="117" cy="50" rx="17" ry="15" fill="${O}"/><path d="M124 43 Q140 48 147 56 Q138 63 122 60 Z" fill="${O}"/>
<path d="M104 55 Q118 68 146 58 Q134 66 118 64 Q108 62 104 55 Z" fill="${W}"/><ellipse cx="146.5" cy="55.5" rx="3.2" ry="2.6" fill="${D}"/>
<g class="eo"><ellipse cx="125" cy="47" rx="2.8" ry="3.4" fill="${D}"/><circle cx="126" cy="45.8" r="1" fill="#fff"/></g>
<g class="et"><ellipse cx="126" cy="45" rx="2.8" ry="3.4" fill="${D}"/><circle cx="127" cy="43.4" r="1" fill="#fff"/></g>
<path class="eh" d="M121 48 Q125 43 129 48" stroke="${D}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path class="ec" d="M121 47.5 Q125 50.5 129 47.5" stroke="${D}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path class="mo" d="M134 61 Q138 64 142 61" stroke="${D}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<g class="mh"><path d="M132 60 Q138 71 144 60 Z" fill="${D}"/><path d="M135 63.5 Q138 68 141 63.5 Z" fill="${PK}"/></g>
<path class="ms" d="M133 64 Q137.5 60.5 142 64" stroke="${D}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
<g class="sw" fill="none" stroke="${BL}" stroke-width="2" stroke-linecap="round"><path d="M135 18 Q140 24 135 30"/><path d="M140 13 Q148 24 140 35"/></g>`;

const scarf = () =>
  `<path d="M100 60 Q108 72 120 64 L121 70 Q108 79 98 66 Z" fill="${BL}"/><path d="M105 69 L100 84 L109 81 Z" fill="${BL}"/>`;

const leg = (c: string, x: number, f: string) =>
  `<g class="${c}"><path d="M${x} 80 L${x - 1} 106 L${x + 7} 106 L${x + 9} 80 Z" fill="${f}"/><rect x="${x - 3}" y="103" width="11" height="7" rx="3" fill="${PW}"/></g>`;

const star = (x: number, y: number, s: number) =>
  `<path d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z" fill="#F7C548"/>`;

export const FOX_SVG = `<g class="p-stand"><g class="tail"><path d="M52 70 C30 72 8 60 10 38 C12 24 28 20 34 32 C38 46 46 56 60 64 Z" fill="${O}"/><path d="M10 38 C11 27 20 21 28 25 C24 31 17 35 10 38 Z" fill="${W}"/></g>
${leg('l2', 65, OD)}${leg('l4', 104, OD)}<ellipse cx="80" cy="76" rx="32" ry="17" fill="${O}"/><ellipse cx="88" cy="85" rx="18" ry="7" fill="${W}"/>${leg('l1', 57, O)}${leg('l3', 96, O)}${scarf()}<g class="headg">${head()}</g></g>
<g class="p-sit"><g class="tail"><path d="M62 108 C80 119 118 118 126 107 C110 112 84 110 70 99 Z" fill="${O}"/><path d="M118 110 C124 103 130 105 127 111 Z" fill="${W}"/></g>
<ellipse cx="76" cy="97" rx="16" ry="13" fill="${OD}"/><ellipse cx="90" cy="82" rx="18" ry="26" fill="${O}"/><ellipse cx="98" cy="85" rx="8" ry="17" fill="${W}"/>
<g><path d="M96 86 L95 108 L101 108 L102 86 Z" fill="${OD}"/><rect x="93" y="103" width="10" height="7" rx="3" fill="${PW}"/></g>
<g class="sl1"><path d="M104 86 L104 108 L110 108 L110 86 Z" fill="${O}"/><rect x="102" y="103" width="10" height="7" rx="3" fill="${PW}"/></g>
<g transform="translate(-16,-3)">${scarf()}</g><g class="headS" transform="translate(-16,-6)">${head()}</g></g>
<g class="p-ball"><path d="M96 74 L100 61 L107 76 Z" fill="${O}"/><path d="M86 72 L88 60 L95 73 Z" fill="${OD}"/><circle cx="88" cy="92" r="21" fill="${O}"/>
<path d="M64 96 C68 120 114 120 112 95 C103 110 78 111 64 96 Z" fill="${OD}"/><path d="M104 101 C109 95 115 97 111 106 C108 109 103 106 104 101 Z" fill="${W}"/>
<path d="M97 86 Q101 89 105 86" stroke="${D}" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="109" cy="90" r="2" fill="${D}"/></g>
<g class="spark">${star(152, 24, 6)}${star(96, 14, 4.5)}${star(162, 50, 4)}</g>
<g class="zz"><text x="112" y="70" font-size="12" font-weight="600">z</text><text x="122" y="60" font-size="14" font-weight="600" style="animation-delay:.6s">z</text><text x="134" y="50" font-size="16" font-weight="600" style="animation-delay:1.2s">Z</text></g>`;

export const CONFETTI_COLORS = ['#EE8434', '#3F6FE0', '#F7C548', '#2E9E6B', '#E86A7A'];
