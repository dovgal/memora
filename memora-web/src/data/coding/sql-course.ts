// 🐘 SQL-трек «Детектив данных» — 8 игровых уроков по SQL и PostgreSQL.
// Все запросы выполняются в настоящем PostgreSQL (PGlite/WASM) прямо в браузере.

import type { Track } from "./types";

// Волшебный зоопарк — общая база для большинства уроков.
const ZOO_SEED = `
CREATE TABLE zveri (
  id INT PRIMARY KEY,
  imya TEXT NOT NULL,
  vid TEXT NOT NULL,
  vozrast INT NOT NULL,
  ves INT NOT NULL
);
INSERT INTO zveri (id, imya, vid, vozrast, ves) VALUES
  (1, 'Пушок',   'дракон',   200, 900),
  (2, 'Искорка', 'феникс',    75, 4),
  (3, 'Гоша',    'грифон',    30, 250),
  (4, 'Мила',    'единорог',  15, 400),
  (5, 'Зубастик','дракон',    12, 150),
  (6, 'Соня',    'феникс',   120, 3),
  (7, 'Барсик',  'грифон',     5, 80);
`;

const DETECTIVE_SEED = `
CREATE TABLE podozrevaemye (
  id INT PRIMARY KEY,
  imya TEXT NOT NULL,
  rost INT NOT NULL,
  lyubit TEXT NOT NULL,
  alibi TEXT NOT NULL
);
INSERT INTO podozrevaemye (id, imya, rost, lyubit, alibi) VALUES
  (1, 'Кот Матвей',    30, 'сметана',  'спал'),
  (2, 'Пёс Шарик',     60, 'косточки', 'гулял'),
  (3, 'Ворона Клара',  20, 'сыр',      'летала'),
  (4, 'Хомяк Боря',    10, 'сыр',      'спал'),
  (5, 'Лиса Алиса',    50, 'сыр',      'неизвестно');
`;

export const sqlTrack: Track = {
  id: "sql",
  emoji: "🐘",
  title: "SQL: Детектив данных",
  tagline: "Допрашивай базы данных и раскрывай тайны — на настоящем PostgreSQL",
  color: "blue",
  intro: [
    "База данных — это огромный умный шкаф с таблицами, где хранится всё на свете: игроки в играх, товары в магазинах, оценки в школе. А SQL (читается «эс-ку-эль») — язык, на котором мы задаём шкафу вопросы.",
    "Ты — новый детектив в агентстве «Данные не врут». Твой инструмент — настоящая база PostgreSQL, которая работает прямо в браузере (да, это не понарошку — тот самый PostgreSQL, которым пользуются взрослые программисты!).",
    "8 дел — 8 уроков. За раскрытые дела — опыт, уровни и звание Мастера данных. Начнём допрос!",
  ],
  finalBadge: { id: "track-sql", emoji: "🕵️", title: "Главный детектив данных: весь трек пройден!" },
  lessons: [
    // ────────────────────────────────────────────────────────── Урок 1
    {
      id: "chto-takoe-bd",
      emoji: "🗄️",
      title: "Дело №1: Волшебный шкаф",
      subtitle: "Что такое таблица и как увидеть всё её содержимое",
      seedSql: ZOO_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Таблица — как в тетради, только умнее",
          text: [
            "Данные в базе живут в таблицах. Таблица — это строки и столбцы, как в тетради в клеточку. Каждая строка — одна «вещь» (зверь, игрок, товар). Каждый столбец — её свойство (имя, возраст, вес).",
            "В нашем волшебном зоопарке есть таблица `zveri` со столбцами: `id` (номер), `imya` (имя), `vid` (вид), `vozrast` (возраст в годах) и `ves` (вес в кг).",
          ],
        },
        {
          kind: "theory",
          id: "t2",
          title: "SELECT * — покажи всё!",
          text: [
            "Главное слово в SQL — `SELECT` («выбери»). Звёздочка `*` значит «все столбцы». `FROM zveri` — «из таблицы zveri».",
            "SQL не различает большие и маленькие буквы в командах, но программисты пишут команды БОЛЬШИМИ — так запрос легче читать. Точка с запятой `;` — точка в конце предложения.",
          ],
          code: "SELECT * FROM zveri;",
          codeNote: "Переводится: «выбери все столбцы из таблицы zveri».",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Перепись волшебного зоопарка",
          story: [
            "Директор зоопарка потерял список зверей! Выведи ВСЮ таблицу `zveri` — все строки, все столбцы.",
          ],
          starterCode: "-- покажи всех зверей\n",
          check: {
            codeContains: ["select", "from", "zveri"],
            expected: {
              rows: [
                ["1", "Пушок", "дракон", "200", "900"],
                ["2", "Искорка", "феникс", "75", "4"],
                ["3", "Гоша", "грифон", "30", "250"],
                ["4", "Мила", "единорог", "15", "400"],
                ["5", "Зубастик", "дракон", "12", "150"],
                ["6", "Соня", "феникс", "120", "3"],
                ["7", "Барсик", "грифон", "5", "80"],
              ],
            },
          },
          hints: [
            "Формула: `SELECT * FROM имя_таблицы;`",
            "Таблица называется `zveri`.",
          ],
          solution: "SELECT * FROM zveri;",
          xp: 15,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что означает звёздочка `*` в запросе SELECT?",
              options: ["Все столбцы", "Умножение", "Одна строка", "Секретные данные"],
              correctIndex: 0,
              explain: "`SELECT *` — «покажи все столбцы таблицы».",
            },
            {
              question: "Что такое строка таблицы?",
              options: [
                "Одна запись — например, один зверь целиком",
                "Одно свойство всех зверей",
                "Название таблицы",
                "Команда SQL",
              ],
              correctIndex: 0,
              explain: "Строка — одна запись со всеми её свойствами. Столбец — одно свойство у всех записей.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 2
    {
      id: "vybor-stolbcov",
      emoji: "🔍",
      title: "Дело №2: Только нужные улики",
      subtitle: "Выбираем отдельные столбцы",
      seedSql: ZOO_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Зачем тащить весь шкаф?",
          text: [
            "Настоящие таблицы бывают ОГРОМНЫМИ — миллионы строк, десятки столбцов. Детектив запрашивает только нужное!",
            "Вместо звёздочки перечисли имена столбцов через запятую — и получишь только их.",
          ],
          code: "SELECT imya, vozrast FROM zveri;",
          codeNote: "Только имена и возрасты — без вида, веса и номеров.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Список имён для таблички",
          story: [
            "Художник рисует таблички на клетки. Ему нужны только столбцы `imya` и `vid` всех зверей — именно в этом порядке.",
          ],
          starterCode: "-- только имя и вид\n",
          check: {
            codeContains: ["select", "imya", "vid", "from"],
            expected: {
              columns: ["imya", "vid"],
              rows: [
                ["Пушок", "дракон"],
                ["Искорка", "феникс"],
                ["Гоша", "грифон"],
                ["Мила", "единорог"],
                ["Зубастик", "дракон"],
                ["Соня", "феникс"],
                ["Барсик", "грифон"],
              ],
            },
          },
          hints: [
            "Столбцы перечисляются через запятую после SELECT.",
            "`SELECT imya, vid FROM zveri;`",
          ],
          solution: "SELECT imya, vid FROM zveri;",
          xp: 15,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Весовая ведомость",
          story: [
            "Ветеринару нужна ведомость: `imya` и `ves` каждого зверя. Составь запрос!",
          ],
          starterCode: "-- имя и вес\n",
          check: {
            codeContains: ["select", "imya", "ves"],
            expected: {
              columns: ["imya", "ves"],
              rows: [
                ["Пушок", "900"],
                ["Искорка", "4"],
                ["Гоша", "250"],
                ["Мила", "400"],
                ["Зубастик", "150"],
                ["Соня", "3"],
                ["Барсик", "80"],
              ],
            },
          },
          hints: ["Так же, как в прошлой задаче, но столбцы другие."],
          solution: "SELECT imya, ves FROM zveri;",
          xp: 15,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Как выбрать только столбец imya из таблицы zveri?",
              options: [
                "`SELECT imya FROM zveri;`",
                "`SELECT zveri FROM imya;`",
                "`SELECT * FROM imya;`",
                "`GET imya;`",
              ],
              correctIndex: 0,
              explain: "SELECT что FROM откуда — золотая формула SQL.",
            },
            {
              question: "Чем разделяют несколько столбцов в SELECT?",
              options: ["Запятой", "Точкой", "Пробелом", "Плюсом"],
              correctIndex: 0,
              explain: "`SELECT imya, vid, ves FROM zveri;` — через запятую.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 3
    {
      id: "where-filtry",
      emoji: "🕵️",
      title: "Дело №3: Кто украл сыр?",
      subtitle: "WHERE — фильтруем строки по условию",
      seedSql: DETECTIVE_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "WHERE — детективный фильтр",
          text: [
            "`WHERE` («где») оставляет только строки, подходящие под условие. Сравнения как в математике: `=`, `>`, `<`, `>=`, `<=`, а «не равно» — `<>`.",
            "Внимание: в SQL «равно» — это ОДИН знак `=` (не два, как в Python!). Текст берём в ОДИНАРНЫЕ кавычки: `'сыр'`.",
          ],
          code: "SELECT * FROM podozrevaemye WHERE lyubit = 'сыр';",
          codeNote: "Только те, кто любит сыр. Уже интересно…",
        },
        {
          kind: "theory",
          id: "t2",
          title: "AND и OR — несколько условий",
          text: [
            "Условия можно соединять: `AND` — «и» (оба верны), `OR` — «или» (хотя бы одно верно).",
          ],
          code: "SELECT * FROM podozrevaemye\nWHERE lyubit = 'сыр' AND rost < 30;",
          codeNote: "Любит сыр И ростом ниже 30 см.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Круг подозреваемых",
          story: [
            "Из холодильника пропал сыр! В таблице `podozrevaemye` — все жители двора (столбцы: `id`, `imya`, `rost`, `lyubit`, `alibi`).",
            "Шаг 1: выведи всех, кто любит сыр (`lyubit = 'сыр'`).",
          ],
          starterCode: "-- кто любит сыр?\n",
          check: {
            codeContains: ["where", "сыр"],
            expected: {
              rows: [
                ["3", "Ворона Клара", "20", "сыр", "летала"],
                ["4", "Хомяк Боря", "10", "сыр", "спал"],
                ["5", "Лиса Алиса", "50", "сыр", "неизвестно"],
              ],
            },
          },
          hints: [
            "`SELECT * FROM podozrevaemye WHERE ...;`",
            "Текст в одинарных кавычках: `lyubit = 'сыр'`.",
          ],
          solution: "SELECT * FROM podozrevaemye WHERE lyubit = 'сыр';",
          xp: 20,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Разоблачение!",
          story: [
            "Улики: полка с сыром висит высоко — вор ростом БОЛЬШЕ 30 см. И у вора нет алиби — в столбце `alibi` у него записано `неизвестно`.",
            "Составь запрос с двумя условиями через `AND` и найди вора! Выведи все столбцы.",
          ],
          starterCode: "-- рост > 30 И алиби неизвестно\n",
          check: {
            codeContains: ["where", "and"],
            expected: {
              rows: [["5", "Лиса Алиса", "50", "сыр", "неизвестно"]],
            },
          },
          hints: [
            "Два условия: `rost > 30 AND alibi = 'неизвестно'`.",
            "Слово «неизвестно» — в одинарных кавычках.",
          ],
          solution: "SELECT * FROM podozrevaemye WHERE rost > 30 AND alibi = 'неизвестно';",
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "В какие кавычки берут текст в SQL?",
              options: ["В одинарные: `'сыр'`", "В двойные", "В фигурные", "Без кавычек"],
              correctIndex: 0,
              explain: "В SQL текст — в одинарных кавычках. (В Python были двойные — легко перепутать!)",
            },
            {
              question: "Что делает `WHERE vozrast > 100`?",
              options: [
                "Оставляет строки, где возраст больше 100",
                "Удаляет старых зверей",
                "Меняет возраст на 100",
                "Сортирует по возрасту",
              ],
              correctIndex: 0,
              explain: "WHERE — фильтр: показывает только подходящие строки, ничего не меняя.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 4
    {
      id: "order-limit",
      emoji: "🏆",
      title: "Дело №4: Турнирная таблица",
      subtitle: "ORDER BY — сортировка, LIMIT — только первые",
      seedSql: ZOO_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Наведи порядок!",
          text: [
            "`ORDER BY столбец` сортирует строки по возрастанию (от меньшего к большему). Добавь `DESC` (descending — «по убыванию») — и порядок перевернётся: сначала самые большие.",
            "`LIMIT 3` оставляет только первые 3 строки результата. Вместе с сортировкой это даёт «топ-3»!",
          ],
          code: "SELECT imya, ves FROM zveri\nORDER BY ves DESC\nLIMIT 3;",
          codeNote: "Топ-3 самых тяжёлых зверя.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "От малышей к старейшинам",
          story: [
            "Выведи `imya` и `vozrast` всех зверей, отсортировав от самого юного к самому старому.",
          ],
          starterCode: "-- сортировка по возрасту\n",
          check: {
            codeContains: ["order by", "vozrast"],
            expected: {
              orderMatters: true,
              rows: [
                ["Барсик", "5"],
                ["Зубастик", "12"],
                ["Мила", "15"],
                ["Гоша", "30"],
                ["Искорка", "75"],
                ["Соня", "120"],
                ["Пушок", "200"],
              ],
            },
          },
          hints: [
            "`ORDER BY vozrast` — по возрастанию, DESC не нужен.",
            "`SELECT imya, vozrast FROM zveri ORDER BY vozrast;`",
          ],
          solution: "SELECT imya, vozrast FROM zveri ORDER BY vozrast;",
          xp: 20,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Двое тяжеловесов",
          story: [
            "На силовое шоу зовут ДВУХ самых тяжёлых зверей. Выведи их `imya` и `ves` — сначала самый тяжёлый.",
          ],
          starterCode: "-- топ-2 по весу\n",
          check: {
            codeContains: ["order by", "desc", "limit"],
            expected: {
              orderMatters: true,
              rows: [
                ["Пушок", "900"],
                ["Мила", "400"],
              ],
            },
          },
          hints: [
            "По убыванию: `ORDER BY ves DESC`.",
            "Только двое: `LIMIT 2` в самом конце.",
          ],
          solution: "SELECT imya, ves FROM zveri ORDER BY ves DESC LIMIT 2;",
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что означает DESC в ORDER BY?",
              options: [
                "По убыванию: сначала самые большие",
                "По возрастанию",
                "Только уникальные",
                "Быстрая сортировка",
              ],
              correctIndex: 0,
              explain: "DESC = descending, по убыванию. Без него — по возрастанию (ASC).",
            },
            {
              question: "Что делает LIMIT 5?",
              options: [
                "Показывает только первые 5 строк результата",
                "Удаляет 5 строк",
                "Показывает 5 столбцов",
                "Ограничивает время запроса",
              ],
              correctIndex: 0,
              explain: "LIMIT обрезает результат до указанного числа строк.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 5
    {
      id: "agregaty",
      emoji: "🧮",
      title: "Дело №5: Великий подсчёт",
      subtitle: "COUNT, SUM, AVG, MAX — база считает за тебя",
      seedSql: ZOO_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Функции-счетоводы",
          text: [
            "SQL умеет считать сам: `COUNT(*)` — сколько строк, `SUM(ves)` — сумма, `AVG(ves)` — среднее (average), `MAX(ves)` и `MIN(ves)` — самое большое и маленькое значение.",
            "Чтобы столбец результата назывался красиво, используй `AS`: `COUNT(*) AS skolko`.",
          ],
          code: "SELECT COUNT(*) AS skolko FROM zveri;\nSELECT MAX(vozrast) AS samyj_staryj FROM zveri;",
          codeNote: "Ответы: 7 зверей; старейшине 200 лет.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Сколько драконов в зоопарке?",
          story: [
            "Бухгалтерия спрашивает: сколько у нас драконов? Посчитай строки, где `vid = 'дракон'`, и назови столбец результата `skolko`.",
          ],
          starterCode: "-- посчитай драконов\n",
          check: {
            codeContains: ["count", "where"],
            expected: { columns: ["skolko"], rows: [["2"]] },
          },
          hints: [
            "Соедини COUNT и WHERE: сначала фильтр, потом подсчёт… а точнее, всё в одном запросе!",
            "`SELECT COUNT(*) AS skolko FROM zveri WHERE vid = 'дракон';`",
          ],
          solution: "SELECT COUNT(*) AS skolko FROM zveri WHERE vid = 'дракон';",
          xp: 20,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Сколько корма закупать?",
          story: [
            "Корма нужно по 2 кг на каждый килограмм зверя, поэтому завхозу нужен ОБЩИЙ вес всех зверей. Выведи сумму столбца `ves` и назови её `obshchij_ves`.",
          ],
          starterCode: "-- общий вес всех зверей\n",
          check: {
            codeContains: ["sum"],
            expected: { columns: ["obshchij_ves"], rows: [["1787"]] },
          },
          hints: [
            "Сумма: `SUM(ves)`.",
            "`SELECT SUM(ves) AS obshchij_ves FROM zveri;`",
          ],
          solution: "SELECT SUM(ves) AS obshchij_ves FROM zveri;",
          xp: 20,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что вернёт `SELECT COUNT(*) FROM zveri;`?",
              options: ["Число строк в таблице", "Все строки", "Сумму весов", "Имена зверей"],
              correctIndex: 0,
              explain: "COUNT(*) считает строки — у нас 7 зверей.",
            },
            {
              question: "Какая функция находит среднее значение?",
              options: ["`AVG`", "`MID`", "`MEAN()`... то есть `SREDNEE`", "`SUM`"],
              correctIndex: 0,
              explain: "AVG — от average, «среднее».",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 6
    {
      id: "group-by",
      emoji: "📊",
      title: "Дело №6: Отчёт по отрядам",
      subtitle: "GROUP BY — считаем по группам",
      seedSql: ZOO_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Раздели и посчитай",
          text: [
            "А если нужно посчитать зверей КАЖДОГО вида отдельно? Не писать же запрос на каждый вид! `GROUP BY vid` делит строки на группы по значению столбца, а функции-счетоводы работают внутри каждой группы.",
            "В SELECT при группировке можно выводить: столбец группировки и функции-счетоводы.",
          ],
          code: "SELECT vid, COUNT(*) AS skolko\nFROM zveri\nGROUP BY vid;",
          codeNote: "Одна строка результата на каждый вид: драконов — 2, фениксов — 2, грифонов — 2, единорогов — 1.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Перекличка по видам",
          story: [
            "Директору нужен отчёт: каждый `vid` и сколько зверей этого вида. Столбец с числом назови `skolko`.",
          ],
          starterCode: "-- vid и количество, сгруппировано\n",
          check: {
            codeContains: ["group by", "count"],
            expected: {
              rows: [
                ["дракон", "2"],
                ["феникс", "2"],
                ["грифон", "2"],
                ["единорог", "1"],
              ],
            },
          },
          hints: [
            "`SELECT vid, COUNT(*) AS skolko FROM zveri GROUP BY vid;`",
            "GROUP BY идёт после FROM (и после WHERE, если он есть).",
          ],
          solution: "SELECT vid, COUNT(*) AS skolko FROM zveri GROUP BY vid;",
          xp: 25,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Средний вес по видам",
          story: [
            "Ветеринар изучает виды: выведи `vid` и МАКСИМАЛЬНЫЙ вес зверя этого вида (назови столбец `max_ves`).",
          ],
          starterCode: "-- vid и максимальный вес по группе\n",
          check: {
            codeContains: ["group by", "max"],
            expected: {
              rows: [
                ["дракон", "900"],
                ["феникс", "4"],
                ["грифон", "250"],
                ["единорог", "400"],
              ],
            },
          },
          hints: ["Вместо COUNT(*) используй `MAX(ves)`."],
          solution: "SELECT vid, MAX(ves) AS max_ves FROM zveri GROUP BY vid;",
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что делает GROUP BY vid?",
              options: [
                "Делит строки на группы с одинаковым vid и позволяет считать внутри групп",
                "Сортирует по vid",
                "Удаляет повторы",
                "Переименовывает столбец",
              ],
              correctIndex: 0,
              explain: "GROUP BY собирает строки в группы — а COUNT/SUM/AVG считают в каждой группе отдельно.",
            },
            {
              question: "Сколько строк вернёт запрос с GROUP BY vid для нашего зоопарка?",
              options: ["4 — по числу разных видов", "7 — по числу зверей", "1", "0"],
              correctIndex: 0,
              explain: "Видов четыре: дракон, феникс, грифон, единорог — по строке на каждый.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 7
    {
      id: "insert-update-delete",
      emoji: "✏️",
      title: "Дело №7: Право на запись",
      subtitle: "INSERT, UPDATE, DELETE — меняем данные",
      seedSql: ZOO_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Три команды-изменялки",
          text: [
            "`INSERT INTO` — добавить строку. `UPDATE` — изменить существующие. `DELETE` — удалить.",
            "⚠️ Золотое правило детектива: у UPDATE и DELETE ВСЕГДА проверяй WHERE! Забудешь — изменишь или удалишь ВСЕ строки таблицы. Не бойся: в песочнице база каждый раз создаётся заново.",
          ],
          code:
            "INSERT INTO zveri (id, imya, vid, vozrast, ves)\nVALUES (8, 'Дымок', 'дракон', 3, 20);\n\nUPDATE zveri SET ves = 25 WHERE imya = 'Дымок';\n\nDELETE FROM zveri WHERE imya = 'Дымок';",
          codeNote: "Добавили дракончика, подкормили до 25 кг, потом отпустили на волю.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Новенький в зоопарке",
          story: [
            "В зоопарк привезли пегаса! Добавь строку: id `8`, имя `Ветерок`, вид `пегас`, возраст `7`, вес `300`. Потом выведи всю таблицу, чтобы убедиться.",
          ],
          starterCode: "-- INSERT, затем SELECT * FROM zveri;\n",
          check: {
            codeContains: ["insert into", "values", "Ветерок"],
            checkQuery: "SELECT imya, vid, vozrast, ves FROM zveri WHERE id = 8;",
            checkRows: [["Ветерок", "пегас", "7", "300"]],
          },
          hints: [
            "`INSERT INTO zveri (id, imya, vid, vozrast, ves) VALUES (...);`",
            "Текст — в одинарных кавычках, числа — без.",
            "Вторая команда: `SELECT * FROM zveri;` — с новой строки.",
          ],
          solution:
            "INSERT INTO zveri (id, imya, vid, vozrast, ves)\nVALUES (8, 'Ветерок', 'пегас', 7, 300);\nSELECT * FROM zveri;",
          xp: 25,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "День рождения Барсика",
          story: [
            "У грифона Барсика день рождения — ему исполнилось 6! Обнови его `vozrast` на 6. Обязательно с WHERE по имени, чтобы не состарить весь зоопарк!",
          ],
          starterCode: "-- UPDATE с WHERE\n",
          check: {
            codeContains: ["update", "set", "where"],
            checkQuery: "SELECT vozrast FROM zveri WHERE imya = 'Барсик';",
            checkRows: [["6"]],
          },
          hints: [
            "`UPDATE zveri SET vozrast = 6 WHERE imya = 'Барсик';`",
            "Проверь одинарные кавычки вокруг имени.",
          ],
          solution: "UPDATE zveri SET vozrast = 6 WHERE imya = 'Барсик';",
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что случится: `DELETE FROM zveri;` — без WHERE?",
              options: [
                "Удалятся ВСЕ звери из таблицы",
                "Ничего",
                "Удалится одна строка",
                "SQL спросит подтверждение",
              ],
              correctIndex: 0,
              explain: "Без WHERE команда применяется ко всем строкам. SQL не переспрашивает — будь внимателен!",
            },
            {
              question: "Какой командой добавляют новую строку?",
              options: ["`INSERT INTO`", "`ADD ROW`", "`NEW`", "`UPDATE`"],
              correctIndex: 0,
              explain: "INSERT INTO таблица (столбцы) VALUES (значения);",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 8
    {
      id: "join-final",
      emoji: "🔗",
      title: "Дело №8: Соедини улики!",
      subtitle: "JOIN — связываем две таблицы. Финальное расследование",
      seedSql:
        ZOO_SEED +
        `
CREATE TABLE kormlenie (
  id INT PRIMARY KEY,
  zver_id INT NOT NULL,
  eda TEXT NOT NULL,
  kg_v_den INT NOT NULL
);
INSERT INTO kormlenie (id, zver_id, eda, kg_v_den) VALUES
  (1, 1, 'уголь',   50),
  (2, 2, 'ягоды',    1),
  (3, 3, 'рыба',    10),
  (4, 4, 'радуга',   2),
  (5, 5, 'уголь',    8),
  (6, 6, 'ягоды',    1),
  (7, 7, 'рыба',     4);
`,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Данные живут в разных таблицах",
          text: [
            "В настоящих базах данные раскладывают по разным таблицам. У нас появилась вторая: `kormlenie` — что ест каждый зверь (`zver_id` — номер зверя из таблицы `zveri`, `eda`, `kg_v_den`).",
            "`JOIN` соединяет таблицы по общему признаку. `ON zveri.id = kormlenie.zver_id` — «склеивай строки, где номер зверя совпадает».",
          ],
          code:
            "SELECT zveri.imya, kormlenie.eda\nFROM zveri\nJOIN kormlenie ON zveri.id = kormlenie.zver_id;",
          codeNote: "Имя из одной таблицы + еда из другой — в одном результате!",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Меню зоопарка",
          story: [
            "Повару нужно меню: имя каждого зверя (`imya`) и его еда (`eda`). Соедини таблицы `zveri` и `kormlenie` через JOIN.",
          ],
          starterCode: "-- JOIN двух таблиц\n",
          check: {
            codeContains: ["join", "on"],
            expected: {
              rows: [
                ["Пушок", "уголь"],
                ["Искорка", "ягоды"],
                ["Гоша", "рыба"],
                ["Мила", "радуга"],
                ["Зубастик", "уголь"],
                ["Соня", "ягоды"],
                ["Барсик", "рыба"],
              ],
            },
          },
          hints: [
            "Скелет: `SELECT zveri.imya, kormlenie.eda FROM zveri JOIN kormlenie ON ...;`",
            "Условие склейки: `zveri.id = kormlenie.zver_id`.",
          ],
          solution:
            "SELECT zveri.imya, kormlenie.eda\nFROM zveri\nJOIN kormlenie ON zveri.id = kormlenie.zver_id;",
          xp: 30,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Финал: кто объедает зоопарк?",
          story: [
            "Финальное расследование! Директор подозревает, что кто-то ест слишком много. Выведи `imya` и `kg_v_den` зверей, которые съедают БОЛЬШЕ 5 кг в день, отсортировав от самого прожорливого.",
            "Понадобится всё: JOIN, WHERE и ORDER BY … DESC. Ты справишься, детектив!",
          ],
          starterCode: "-- JOIN + WHERE + ORDER BY DESC\n",
          check: {
            codeContains: ["join", "where", "order by"],
            expected: {
              orderMatters: true,
              rows: [
                ["Пушок", "50"],
                ["Гоша", "10"],
                ["Зубастик", "8"],
              ],
            },
          },
          hints: [
            "Начни с запроса из прошлой задачи, но выведи `kg_v_den` вместо еды.",
            "Фильтр: `WHERE kormlenie.kg_v_den > 5`.",
            "Сортировка: `ORDER BY kormlenie.kg_v_den DESC`.",
          ],
          solution:
            "SELECT zveri.imya, kormlenie.kg_v_den\nFROM zveri\nJOIN kormlenie ON zveri.id = kormlenie.zver_id\nWHERE kormlenie.kg_v_den > 5\nORDER BY kormlenie.kg_v_den DESC;",
          xp: 35,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Экзамен детектива",
          xp: 15,
          questions: [
            {
              question: "Для чего нужен JOIN?",
              options: [
                "Соединить строки из двух таблиц по общему признаку",
                "Удалить таблицу",
                "Ускорить запрос",
                "Создать копию таблицы",
              ],
              correctIndex: 0,
              explain: "JOIN склеивает таблицы — например, зверя с его кормлением по номеру.",
            },
            {
              question: "В каком порядке идут части запроса?",
              options: [
                "`SELECT` → `FROM` → `WHERE` → `ORDER BY`",
                "`WHERE` → `SELECT` → `FROM`",
                "`FROM` → `ORDER BY` → `SELECT`",
                "Порядок не важен",
              ],
              correctIndex: 0,
              explain: "Именно так: выбери → откуда → с каким фильтром → как отсортировать. Дело закрыто, детектив! 🕵️",
            },
            {
              question: "Ты выучил SQL для настоящей базы PostgreSQL. Это правда?",
              options: [
                "Да! PGlite в песочнице — это настоящий PostgreSQL",
                "Нет, это игрушечный язык",
                "PostgreSQL — это язык Python",
                "SQL работает только в браузере",
              ],
              correctIndex: 0,
              explain: "Чистая правда: все твои запросы выполнял настоящий PostgreSQL. Эти же команды работают на взрослых серверах!",
            },
          ],
        },
      ],
    },
  ],
};
