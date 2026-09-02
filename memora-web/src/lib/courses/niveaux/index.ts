// Тренажёры уровней B1–C2. Один формат (EditoUnit), общие компоненты,
// у каждого уровня свой courseId для прогресса/коуча/статистики.

import type { EditoUnit } from '@/lib/courses/edito-a1';

import b1u1 from './b1/unite1.json'; import b1u2 from './b1/unite2.json';
import b1u3 from './b1/unite3.json'; import b1u4 from './b1/unite4.json';
import b1u5 from './b1/unite5.json'; import b1u6 from './b1/unite6.json';
import b2u1 from './b2/unite1.json'; import b2u2 from './b2/unite2.json';
import b2u3 from './b2/unite3.json'; import b2u4 from './b2/unite4.json';
import b2u5 from './b2/unite5.json'; import b2u6 from './b2/unite6.json';
import c1u1 from './c1/unite1.json'; import c1u2 from './c1/unite2.json';
import c1u3 from './c1/unite3.json'; import c1u4 from './c1/unite4.json';
import c1u5 from './c1/unite5.json';
import c2u1 from './c2/unite1.json'; import c2u2 from './c2/unite2.json';
import c2u3 from './c2/unite3.json'; import c2u4 from './c2/unite4.json';
import c2u5 from './c2/unite5.json';
import b2u7 from './b2/unite7.json';
import c1u6 from './c1/unite6.json';
import c2u6 from './c2/unite6.json';
import pr1 from './presse/unite1.json'; import pr2 from './presse/unite2.json';
import pr3 from './presse/unite3.json';
import ph1 from './phonetique/unite1.json'; import ph2 from './phonetique/unite2.json';
import c2u7 from './c2/unite7.json'; import c2u8 from './c2/unite8.json';
import le1 from './lecture/unite1.json'; import le2 from './lecture/unite2.json';
import le3 from './lecture/unite3.json'; import le4 from './lecture/unite4.json';
import vb1 from './verbes/unite1.json'; import vb2 from './verbes/unite2.json';
import vb3 from './verbes/unite3.json'; import vb4 from './verbes/unite4.json';
import vb5 from './verbes/unite5.json'; import vb6 from './verbes/unite6.json';
import vb7 from './verbes/unite7.json';
import vb8 from './verbes/unite8.json'; import vb9 from './verbes/unite9.json';
import vb10 from './verbes/unite10.json';
import vb11 from './verbes/unite11.json'; import vb12 from './verbes/unite12.json';
import vb13 from './verbes/unite13.json';
import vb14 from './verbes/unite14.json'; import vb15 from './verbes/unite15.json';
import vb16 from './verbes/unite16.json';
import vb17 from './verbes/unite17.json'; import vb18 from './verbes/unite18.json';
import hp1 from './homophones/unite1.json'; import hp2 from './homophones/unite2.json';
import hp3 from './homophones/unite3.json'; import hp4 from './homophones/unite4.json';
import or1 from './orthographe/unite1.json'; import or2 from './orthographe/unite2.json';
import ot1 from './orthotypo/unite1.json'; import ot2 from './orthotypo/unite2.json';
import vv1a from '../vivre/t01-a1.json'; import vv1b from '../vivre/t01-b1.json';
import pro1 from './pro/unite1.json'; import pro2 from './pro/unite2.json';
import pro3 from './pro/unite3.json'; import pro4 from './pro/unite4.json';
import pro5 from './pro/unite5.json'; import pro6 from './pro/unite6.json';

const U = (m: unknown) => m as EditoUnit;

export interface LevelCourse {
  id: string;            // 'b1' | 'b2' | 'c1' | 'c2'
  courseId: string;      // для прогресса/коуча
  title: string;
  level: string;         // 'B1'…
  description: string;
  accent: string;        // tailwind-цвет акцента
  units: Record<string, EditoUnit>;
  order: string[];
}

export const LEVELS: Record<string, LevelCourse> = {
  // Жизнь во Франции: не грамматика по темам, а темы по жизни. Каждая тема —
  // две ступени: сначала выжить (назвать, показать, попросить), потом говорить.
  vivre: {
    id: 'vivre', courseId: 'vivre-france', title: 'Жизнь во Франции', level: 'A1–B1',
    description: 'Двенадцать тем повседневной жизни: подъезд, мэрия, аптека, транспорт. Слова с местом на картинке, произношение вслух и разговор с собеседником, у которого к вам вопросы.',
    accent: 'emerald',
    units: { '1a': U(vv1a), '1b': U(vv1b) },
    order: ['1a', '1b'],
  },
  b1: {
    id: 'b1', courseId: 'niveau-b1', title: 'Французский B1', level: 'B1',
    description: 'Пороговый уровень: рассказ о прошлом, мнение и субжонктив, гипотезы, местоимения, пассив, косвенная речь.',
    accent: 'sky',
    units: { '1': U(b1u1), '2': U(b1u2), '3': U(b1u3), '4': U(b1u4), '5': U(b1u5), '6': U(b1u6) },
    order: ['1','2','3','4','5','6'],
  },
  b2: {
    id: 'b2', courseId: 'niveau-b2', title: 'Французский B2', level: 'B2',
    description: 'Продвинутый уровень: все времена прошлого, выбор режима, гипотезы и сожаления, уступка, причастия, mise en relief.',
    accent: 'violet',
    units: { '1': U(b2u1), '2': U(b2u2), '3': U(b2u3), '4': U(b2u4), '5': U(b2u5), '6': U(b2u6), '7': U(b2u7) },
    order: ['1','2','3','4','5','6','7'],
  },
  c1: {
    id: 'c1', courseId: 'niveau-c1', title: 'Французский C1', level: 'C1',
    description: 'Свободное владение: модализация, литературные времена, продвинутые коннекторы, регистры, книжный синтаксис.',
    accent: 'amber',
    units: { '1': U(c1u1), '2': U(c1u2), '3': U(c1u3), '4': U(c1u4), '5': U(c1u5), '6': U(c1u6) },
    order: ['1','2','3','4','5','6'],
  },
  c2: {
    id: 'c2', courseId: 'niveau-c2', title: 'Французский C2', level: 'C2',
    description: 'Мастерство: синтез и реформулировка, фигуры речи, идиоматика soutenu, искусство аргументации, грамматические тонкости.',
    accent: 'rose',
    units: { '1': U(c2u1), '2': U(c2u2), '3': U(c2u3), '4': U(c2u4), '5': U(c2u5), '6': U(c2u6), '7': U(c2u7), '8': U(c2u8) },
    order: ['1','2','3','4','5','6','7','8'],
  },
  presse: {
    id: 'presse', courseId: 'niveau-presse', title: 'Язык прессы', level: 'B1–C1',
    description: 'Французский новостей: заголовки и их грамматика, лексика экономики и общества, глаголы цитирования и источники.',
    accent: 'cyan',
    units: { '1': U(pr1), '2': U(pr2), '3': U(pr3) },
    order: ['1','2','3'],
  },
  phonetique: {
    id: 'phonetique', courseId: 'niveau-phonetique', title: 'Фонетика B1–B2', level: 'B1–B2',
    description: 'Звучать естественно: ритмические группы и интонация, факультативные liaisons, выпадение e caduc, стиль и беглость.',
    accent: 'teal',
    units: { '1': U(ph1), '2': U(ph2) },
    order: ['1','2'],
  },
  lecture: {
    id: 'lecture', courseId: 'niveau-lecture', title: 'Lecture suivie — чтение книг', level: 'A2–B2',
    description: 'Компаньон к адаптированным книгам: план чтения по главам, проверка понимания сюжета, словарь книги — в личный набор. Читайте и слушайте ваше издание, проверяйте себя здесь.',
    accent: 'orange',
    units: { '1': U(le1), '2': U(le2), '3': U(le3), '4': U(le4) },
    order: ['1','2','3','4'],
  },
  verbes: {
    id: 'verbes', courseId: 'niveau-verbes', title: 'Les verbes et leurs prépositions', level: 'A2–B2',
    description: 'Система глагольных управлений: transitif/intransitif, глаголы с à и de, двойные дополнения, à/de + infinitif, предлоги-смыслоразличители. Теория на русском, словари юнитов — в личные наборы.',
    accent: 'lime',
    units: { '1': U(vb1), '2': U(vb2), '3': U(vb3), '4': U(vb4), '5': U(vb5), '6': U(vb6), '7': U(vb7), '8': U(vb8), '9': U(vb9), '10': U(vb10), '11': U(vb11), '12': U(vb12), '13': U(vb13), '14': U(vb14), '15': U(vb15), '16': U(vb16), '17': U(vb17), '18': U(vb18) },
    order: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18'],
  },
  homophones: {
    id: 'homophones', courseId: 'niveau-homophones', title: 'Омофоны и ловушки', level: 'A2–C1',
    description: "Метод Projet Voltaire: a/à, et/est, son/sont, on/ont, ce/se, c'est/s'est, ces/ses, leur/leurs, peut/peu, prêt/près… Объяснения — приёмы подстановки (Astuces). Каждый повтор — новое предложение того же правила.",
    accent: 'fuchsia',
    units: { '1': U(hp1), '2': U(hp2), '3': U(hp3), '4': U(hp4) },
    order: ['1','2','3','4'],
  },
  orthographe: {
    id: 'orthographe', courseId: 'niveau-orthographe', title: "Orthographe d'usage", level: 'B1–C1',
    description: "Орфография употребления (Voltaire): наречия -amment/-emment, удвоение согласных, accents и cédille, лексические омофоны (session/cession, censé/sensé, voix/voie). Объяснения — приёмы и подстановки.",
    accent: 'indigo',
    units: { '1': U(or1), '2': U(or2) },
    order: ['1','2'],
  },
  orthotypo: {
    id: 'orthotypo', courseId: 'niveau-orthotypo', title: 'Orthotypographie', level: 'B2–C1',
    description: 'Типографика Voltaire: пробелы перед ; : ! ?, проценты (30 %), часы (8 h 30), n° 10, кавычки-ёлочки « », сокращения M./Mme, акценты на заглавных (État), etc.',
    accent: 'slate',
    units: { '1': U(ot1), '2': U(ot2) },
    order: ['1','2'],
  },
  pro: {
    id: 'pro', courseId: 'niveau-pro-intersport', title: 'Français professionnel — Entretien (Intersport)', level: 'B1–B2',
    description: 'Профессиональная лексика для собеседования на Responsable Adjointe: коллективный договор, договоры и зарплата, рабочее время, безопасность и касса, управление командой, коммерческие показатели и обслуживание клиентов. Кнопка «В личный набор» делает из терминов карточки FR↔RU с озвучкой.',
    accent: 'pink',
    units: { '1': U(pro1), '2': U(pro2), '3': U(pro3), '4': U(pro4), '5': U(pro5), '6': U(pro6) },
    order: ['1','2','3','4','5','6'],
  },
};
