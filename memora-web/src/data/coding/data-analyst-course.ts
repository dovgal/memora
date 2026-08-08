// 📊 Трек «Python и SQL для аналитика данных» — 8 уроков.
// Рассчитан на тех, кто уже прошёл базовые треки Python и SQL (или знает основы
// самостоятельно) и хочет прикладных навыков дата-аналитика: парсинг данных,
// статистика, оконные функции, CTE, работа с датами, сводные таблицы.
// SQL-задачи выполняются в настоящем PostgreSQL (PGlite) прямо в браузере.

import type { Track } from "./types";

// Витрина продаж интернет-магазина за первый квартал — сквозной набор данных
// для всех SQL-уроков этого трека.
const SALES_SEED = `
CREATE TABLE sales (
  id INT PRIMARY KEY,
  sale_date DATE NOT NULL,
  region TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL
);
INSERT INTO sales (id, sale_date, region, category, amount) VALUES
  (1,  '2024-01-05', 'Москва',     'Электроника', 1200),
  (2,  '2024-01-12', 'Москва',     'Одежда',       450),
  (3,  '2024-01-20', 'Казань',     'Электроника',  980),
  (4,  '2024-01-28', 'Петербург',  'Книги',        210),
  (5,  '2024-02-03', 'Москва',     'Электроника', 1600),
  (6,  '2024-02-10', 'Казань',     'Одежда',       620),
  (7,  '2024-02-14', 'Петербург',  'Электроника', 1100),
  (8,  '2024-02-22', 'Москва',     'Книги',        180),
  (9,  '2024-02-27', 'Казань',     'Книги',        140),
  (10, '2024-03-02', 'Петербург',  'Одежда',       390),
  (11, '2024-03-09', 'Москва',     'Одежда',       510),
  (12, '2024-03-15', 'Казань',     'Электроника', 1340),
  (13, '2024-03-18', 'Петербург',  'Книги',        260),
  (14, '2024-03-24', 'Москва',     'Электроника', 1450),
  (15, '2024-03-29', 'Казань',     'Одежда',       700);
`;

// Таблица менеджеров по регионам — для урока про JOIN. Петербург намеренно
// без менеджера, чтобы показать разницу между INNER JOIN и LEFT JOIN.
const MANAGERS_SEED = `
CREATE TABLE managers (
  region TEXT PRIMARY KEY,
  manager_name TEXT NOT NULL
);
INSERT INTO managers (region, manager_name) VALUES
  ('Москва', 'Ирина Соколова'),
  ('Казань', 'Олег Петров');
`;

// «Грязные» отзывы покупателей — для урока про HAVING и очистку текста:
// разный регистр/пробелы у одного имени и пропущенные email (NULL).
const FEEDBACK_SEED = `
CREATE TABLE feedback (
  id INT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  email TEXT,
  rating INT NOT NULL,
  comment TEXT NOT NULL
);
INSERT INTO feedback (id, customer_name, email, rating, comment) VALUES
  (1, '  Анна  ', 'anna@mail.ru', 5, 'Отличный сервис, всё быстро!'),
  (2, 'борис', NULL, 2, 'Долго ждал доставку'),
  (3, 'Анна', 'anna@mail.ru', 4, 'В целом хорошо'),
  (4, 'Вера', 'vera@mail.ru', 1, 'Товар пришёл повреждённым'),
  (5, 'АННА', NULL, 5, 'Закажу ещё раз'),
  (6, 'Глеб', 'gleb@mail.ru', 3, 'Нормально, но долго ждал');
`;

export const dataAnalystTrack: Track = {
  id: "data-analyst",
  emoji: "📊",
  title: "Python и SQL для аналитика данных",
  tagline: "От сырых данных к выводам, на которые опирается бизнес",
  color: "purple",
  intro: [
    "Этот трек — для тех, кто уже знает основы Python и SQL (прошёл треки «Академия юных кодеров» и «Детектив данных», или знает их эквивалент) и хочет прокачать прикладные навыки дата-аналитика.",
    "Здесь два инструмента работают вместе, как у настоящего аналитика: Python — чтобы разобрать и посчитать данные вручную, когда под рукой только текст, а SQL — чтобы задавать умные вопросы прямо базе данных: не «покажи всё», а «покажи тренд», «сравни регионы», «найди топ-3».",
    "Сквозной пример: витрина продаж интернет-магазина за первый квартал. К концу трека ты умеешь строить отчёты, которые реально может показать руководителю.",
  ],
  finalBadge: { id: "track-data-analyst", emoji: "📈", title: "Дата-аналитик: весь трек пройден!" },
  lessons: [
    // ────────────────────────────────────────────────────────── Урок 1
    {
      id: "csv-i-slovari",
      emoji: "🗂️",
      title: "CSV и словари: как выглядят настоящие данные",
      subtitle: "Модуль csv превращает текст в таблицу",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Данные редко приходят готовыми",
          text: [
            "В реальной работе данные почти никогда не лежат в удобном списке чисел — обычно это текстовый файл CSV (Comma-Separated Values, «значения через запятую»): первая строка — заголовки столбцов, дальше — строки данных.",
            "Модуль `csv` умеет читать такой текст. `csv.DictReader` превращает каждую строку в словарь: ключи — заголовки, значения — то, что в ячейке. Так строка `Анна,Маркетинг,75000` станет `{'name': 'Анна', 'department': 'Маркетинг', 'salary': '75000'}`.",
          ],
          code:
            'import csv\nimport io\n\ndata = """name,department,salary\nАнна,Маркетинг,75000\nБорис,Продажи,62000"""\n\nreader = csv.DictReader(io.StringIO(data))\nfor row in reader:\n    print(row)',
          codeNote: "io.StringIO() превращает текстовую строку в «файл», который умеет читать csv.DictReader.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "Важная ловушка: всё — строки",
          text: [
            "csv.DictReader не знает, что `'75000'` — это число. Для него это просто текст. Если нужно посчитать сумму, сначала обязательно преврати строку в число: `int(row['salary'])` или `float(...)`.",
            "Забыть об этом — самая частая ошибка при первом знакомстве с CSV: `'75000' + '62000'` склеит строки в `'7500062000'`, а не сложит числа!",
          ],
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Сколько сотрудников в отчёте?",
          story: [
            "Отдел кадров прислал CSV-выгрузку (она уже лежит в переменной `data`). Посчитай, сколько строк с сотрудниками в ней — то есть сколько человек в отчёте.",
          ],
          starterCode:
            'import csv\nimport io\n\ndata = """name,department,salary\nАнна,Маркетинг,75000\nБорис,Продажи,62000\nВера,Маркетинг,81000\nГлеб,IT,95000\nДарья,Продажи,58000"""\n\n# посчитай количество строк\n',
          check: { expectedOutput: "5", codeContains: ["DictReader"] },
          hints: [
            "`reader = csv.DictReader(io.StringIO(data))` — а дальше собери строки в список: `rows = list(reader)`.",
            "Количество строк — это `len(rows)`.",
          ],
          solution:
            'import csv\nimport io\n\ndata = """name,department,salary\nАнна,Маркетинг,75000\nБорис,Продажи,62000\nВера,Маркетинг,81000\nГлеб,IT,95000\nДарья,Продажи,58000"""\n\nreader = csv.DictReader(io.StringIO(data))\nrows = list(reader)\nprint(len(rows))',
          xp: 20,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Фонд заработной платы",
          story: [
            "Теперь посчитай общую сумму зарплат из того же отчёта. Не забудь: `row['salary']` — это строка, её нужно превратить в число перед сложением!",
          ],
          starterCode:
            'import csv\nimport io\n\ndata = """name,department,salary\nАнна,Маркетинг,75000\nБорис,Продажи,62000\nВера,Маркетинг,81000\nГлеб,IT,95000\nДарья,Продажи,58000"""\n\n# посчитай сумму столбца salary\n',
          check: { expectedOutput: "371000", codeContains: ["int(", "DictReader"] },
          hints: [
            "Заведи `total = 0`, потом циклом `for row in reader:` добавляй `int(row[\"salary\"])`.",
            "В конце `print(total)`.",
          ],
          solution:
            'import csv\nimport io\n\ndata = """name,department,salary\nАнна,Маркетинг,75000\nБорис,Продажи,62000\nВера,Маркетинг,81000\nГлеб,IT,95000\nДарья,Продажи,58000"""\n\nreader = csv.DictReader(io.StringIO(data))\ntotal = 0\nfor row in reader:\n    total = total + int(row["salary"])\nprint(total)',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Во что csv.DictReader превращает каждую строку CSV?",
              options: ["В словарь (dict)", "В список чисел", "В отдельный файл", "В переменную типа int"],
              correctIndex: 0,
              explain: "Ключи словаря — заголовки столбцов, значения — содержимое ячеек этой строки.",
            },
            {
              question: "Что нужно сделать перед тем, как складывать числа из CSV?",
              options: [
                "Превратить строку в число: int(...) или float(...)",
                "Ничего, csv сам всё понимает",
                "Умножить на 1",
                "Удалить кавычки вручную",
              ],
              correctIndex: 0,
              explain: "csv.DictReader всегда отдаёт текст — тип надо привести самому.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 2
    {
      id: "statistika",
      emoji: "📐",
      title: "Модуль statistics: среднее, медиана, разброс",
      subtitle: "Три числа, которые говорят о данных больше, чем сто строк",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Среднее и медиана — не одно и то же",
          text: [
            "`statistics.mean()` — среднее арифметическое: сумма делённая на количество. `statistics.median()` — «средний» элемент, если все значения выстроить по порядку.",
            "Почему это важно: если в списке зарплат один человек получает в 10 раз больше остальных, среднее «утянется» вверх и создаст ложное впечатление, что все получают много. Медиана устойчивее к таким выбросам — это одна из первых вещей, которую проверяет аналитик.",
          ],
          code: "import statistics\n\nzp = [50000, 52000, 51000, 300000]\nprint(round(statistics.mean(zp)))\nprint(round(statistics.median(zp)))",
          codeNote: "Среднее — 113250 (искажено выбросом), медиана — 51500 (честнее отражает «типичную» зарплату).",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Средняя и типичная зарплата",
          story: [
            "В отделе пять зарплат: `[75000, 62000, 81000, 95000, 58000]`. Посчитай и напечатай сначала округлённое среднее, потом округлённую медиану.",
          ],
          starterCode: "import statistics\n\nsalaries = [75000, 62000, 81000, 95000, 58000]\n# среднее и медиана, округлённые\n",
          check: { expectedOutput: "74200\n75000", codeContains: ["statistics.mean", "statistics.median"] },
          hints: [
            "`round(statistics.mean(salaries))` — округление до целого.",
            "Дальше так же с `statistics.median(salaries)`.",
          ],
          solution:
            "import statistics\n\nsalaries = [75000, 62000, 81000, 95000, 58000]\nprint(round(statistics.mean(salaries)))\nprint(round(statistics.median(salaries)))",
          xp: 20,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Насколько разбросаны зарплаты?",
          story: [
            "`statistics.stdev()` считает стандартное отклонение — насколько в среднем значения отклоняются от среднего. Чем оно больше, тем сильнее разброс. Посчитай его для тех же зарплат (округли до целого).",
          ],
          starterCode: "import statistics\n\nsalaries = [75000, 62000, 81000, 95000, 58000]\n# стандартное отклонение, округлённое\n",
          check: { expectedOutput: "14923", codeContains: ["statistics.stdev"] },
          hints: ["`round(statistics.stdev(salaries))`."],
          solution: "import statistics\n\nsalaries = [75000, 62000, 81000, 95000, 58000]\nprint(round(statistics.stdev(salaries)))",
          xp: 20,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Почему медиана устойчивее к выбросам, чем среднее?",
              options: [
                "Медиана — это средний по порядку элемент, а не сумма, поэтому один огромный выброс не тянет её вверх",
                "Медиана всегда равна среднему",
                "Медиана — это просто максимум списка",
                "Разницы нет, это два названия одного и того же",
              ],
              correctIndex: 0,
              explain: "Именно так: выброс сдвигает сумму (и среднее) сильно, а положение «середины» списка — почти не меняет.",
            },
            {
              question: "Что показывает большое стандартное отклонение?",
              options: [
                "Значения сильно разбросаны относительно среднего",
                "Все значения одинаковые",
                "В списке ошибка",
                "Среднее посчитано неверно",
              ],
              correctIndex: 0,
              explain: "Малое отклонение = значения кучкуются возле среднего. Большое = сильно разбросаны.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 3
    {
      id: "counter-defaultdict",
      emoji: "🧮",
      title: "Считаем руками: Counter и defaultdict",
      subtitle: "Группировка данных без единой строки SQL",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Counter — счётчик частоты",
          text: [
            "`from collections import Counter` — Counter считает, сколько раз встретилось каждое значение в списке. `.most_common(1)` отдаёт самое частое значение и то, сколько раз оно встретилось.",
          ],
          code:
            'from collections import Counter\n\nvisits = ["главная", "каталог", "главная", "корзина", "главная"]\ncounts = Counter(visits)\nprint(counts.most_common(1))',
          codeNote: "Выведет [('главная', 3)] — список из одной пары (значение, количество).",
        },
        {
          kind: "theory",
          id: "t2",
          title: "defaultdict — суммируем по группам",
          text: [
            "`from collections import defaultdict` — как обычный словарь, но с одним удобством: если ключа ещё нет, он не выдаёт ошибку, а создаёт значение по умолчанию (например, `0` для `defaultdict(int)`). Это идеально для суммирования по группам.",
          ],
          code:
            'from collections import defaultdict\n\ntotals = defaultdict(int)\ntotals["Москва"] += 100\ntotals["Москва"] += 50\ntotals["Казань"] += 30\nprint(dict(totals))',
          codeNote: "Ключ «Москва» не нужно было создавать заранее — defaultdict сам подставил 0 при первом обращении.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Самый активный отдел",
          story: [
            "Список отделов, в которых произошли события за день: `[\"Маркетинг\", \"Продажи\", \"Маркетинг\", \"IT\", \"Продажи\", \"Продажи\"]`. С помощью `Counter` найди самый частый отдел и напечатай сначала его название, потом — сколько раз он встретился.",
          ],
          starterCode:
            'from collections import Counter\n\ndepartments = ["Маркетинг", "Продажи", "Маркетинг", "IT", "Продажи", "Продажи"]\n# найди самый частый отдел\n',
          check: { expectedOutput: "Продажи\n3", codeContains: ["Counter", "most_common"] },
          hints: [
            "`counts = Counter(departments)`",
            "`most_common(1)` возвращает список из одной пары: `[(имя, число)]`. Достань её так: `dept, n = counts.most_common(1)[0]`.",
          ],
          solution:
            'from collections import Counter\n\ndepartments = ["Маркетинг", "Продажи", "Маркетинг", "IT", "Продажи", "Продажи"]\ncounts = Counter(departments)\nmost_common_dept, most_common_count = counts.most_common(1)[0]\nprint(most_common_dept)\nprint(most_common_count)',
          xp: 20,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Зарплатный фонд по отделам",
          story: [
            "Дан список пар (отдел, зарплата). С помощью `defaultdict(int)` посчитай сумму зарплат по каждому отделу и напечатай построчно в формате `Отдел: сумма`, в алфавитном порядке отделов (используй `sorted(...)` по ключам словаря).",
          ],
          starterCode:
            'from collections import defaultdict\n\nrows = [\n    ("Маркетинг", 75000),\n    ("Продажи", 62000),\n    ("Маркетинг", 81000),\n    ("IT", 95000),\n    ("Продажи", 58000),\n]\n# сумма по отделам, в алфавитном порядке\n',
          check: {
            expectedOutput: "IT: 95000\nМаркетинг: 156000\nПродажи: 120000",
            codeContains: ["defaultdict", "sorted"],
          },
          hints: [
            "`totals = defaultdict(int)`, потом `for dept, salary in rows: totals[dept] += salary`.",
            "Для порядка по алфавиту: `for dept in sorted(totals):`.",
            "Печать строки: `print(f\"{dept}: {totals[dept]}\")`.",
          ],
          solution:
            'from collections import defaultdict\n\nrows = [\n    ("Маркетинг", 75000),\n    ("Продажи", 62000),\n    ("Маркетинг", 81000),\n    ("IT", 95000),\n    ("Продажи", 58000),\n]\ntotals = defaultdict(int)\nfor dept, salary in rows:\n    totals[dept] += salary\n\nfor dept in sorted(totals):\n    print(f"{dept}: {totals[dept]}")',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что делает counts.most_common(1)?",
              options: [
                "Возвращает список из одной пары: самое частое значение и сколько раз оно встретилось",
                "Удаляет самое частое значение",
                "Считает только уникальные значения",
                "Сортирует список по алфавиту",
              ],
              correctIndex: 0,
              explain: "most_common(N) отдаёт N самых частых пар (значение, количество) по убыванию частоты.",
            },
            {
              question: "Чем defaultdict(int) отличается от обычного словаря?",
              options: [
                "При обращении к несуществующему ключу создаёт его со значением 0, а не выдаёт ошибку",
                "Не умеет хранить числа",
                "Работает только со строками",
                "Автоматически сортирует ключи",
              ],
              correctIndex: 0,
              explain: "Это и убирает необходимость проверять «а есть ли уже такой ключ» перед каждым += .",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 4
    {
      id: "okonnye-funktsii",
      emoji: "🪟",
      title: "Оконные функции: ROW_NUMBER и running total",
      subtitle: "SQL-приём, без которого не обходится ни один аналитик",
      seedSql: SALES_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "OVER() — окно, через которое видно другие строки",
          text: [
            "Обычные агрегаты (`SUM`, `COUNT`) сливают много строк в одну. Оконная функция считает то же самое, но НЕ сливает строки — каждая остаётся на месте, просто получает дополнительный столбец с результатом.",
            "`ROW_NUMBER() OVER (PARTITION BY регион ORDER BY сумма DESC)` — пронумеровать строки внутри каждого региона отдельно, от самой крупной продажи к самой мелкой. `PARTITION BY` — это как `GROUP BY`, но без склеивания строк.",
          ],
          code:
            "SELECT region, amount,\n  ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) AS rn\nFROM sales\nORDER BY region, rn;",
          codeNote: "У каждого региона своя нумерация 1, 2, 3… — независимо от других регионов.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "Бегущий итог: SUM() OVER (ORDER BY ...)",
          text: [
            "Тот же приём с `SUM` вместо `ROW_NUMBER` даёт «накопительный итог» — сумму от начала до текущей строки. Без `PARTITION BY` окно — вся таблица (или её отфильтрованная часть).",
          ],
          code: "SELECT sale_date, amount,\n  SUM(amount) OVER (ORDER BY sale_date) AS running_total\nFROM sales\nWHERE region = 'Москва'\nORDER BY sale_date;",
          codeNote: "Каждая строка показывает не только свою продажу, но и сумму всех продаж Москвы до неё включительно.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Лучшая продажа в каждом регионе",
          story: [
            "Найди самую крупную продажу (`amount`) в КАЖДОМ регионе. Используй `ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC)` во вложенном запросе, а во внешнем оставь только строки с номером 1. Выведи `region` и `amount`.",
          ],
          starterCode:
            "-- вложенный запрос с ROW_NUMBER, во внешнем — WHERE rn = 1\nSELECT region, amount FROM (\n  SELECT region, amount, ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) AS rn\n  FROM sales\n) t\nWHERE rn = 1;\n",
          check: {
            codeContains: ["row_number", "partition by"],
            expected: {
              rows: [
                ["Казань", "1340"],
                ["Москва", "1600"],
                ["Петербург", "1100"],
              ],
            },
          },
          hints: [
            "Оконную функцию нельзя напрямую поставить в WHERE — поэтому она сначала считается во вложенном запросе, а фильтр `WHERE rn = 1` идёт снаружи.",
            "Заготовка кода уже почти готова — просто запусти её и посмотри на результат!",
          ],
          solution:
            "SELECT region, amount FROM (\n  SELECT region, amount, ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) AS rn\n  FROM sales\n) t\nWHERE rn = 1;",
          xp: 30,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Бегущий итог продаж в Москве",
          story: [
            "Для продаж региона `Москва` выведи `sale_date`, `amount` и накопительную сумму продаж на эту дату (столбец назови `running_total`), отсортировав по дате.",
          ],
          starterCode: "-- SUM() OVER (ORDER BY ...) + WHERE region\n",
          check: {
            codeContains: ["sum(amount) over", "where"],
            expected: {
              orderMatters: true,
              columns: ["sale_date", "amount", "running_total"],
              rows: [
                ["2024-01-05", "1200", "1200"],
                ["2024-01-12", "450", "1650"],
                ["2024-02-03", "1600", "3250"],
                ["2024-02-22", "180", "3430"],
                ["2024-03-09", "510", "3940"],
                ["2024-03-24", "1450", "5390"],
              ],
            },
          },
          hints: [
            "`SUM(amount) OVER (ORDER BY sale_date) AS running_total`.",
            "Не забудь `WHERE region = 'Москва'` и `ORDER BY sale_date` в конце запроса.",
          ],
          solution:
            "SELECT sale_date, amount, SUM(amount) OVER (ORDER BY sale_date) AS running_total\nFROM sales\nWHERE region = 'Москва'\nORDER BY sale_date;",
          xp: 30,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Чем оконная функция отличается от обычного GROUP BY?",
              options: [
                "Она не склеивает строки в одну — каждая строка остаётся, просто получает новый столбец",
                "Она всегда медленнее",
                "Работает только с датами",
                "Ничем не отличается",
              ],
              correctIndex: 0,
              explain: "GROUP BY уменьшает количество строк, оконная функция — нет. Это и есть их главное отличие.",
            },
            {
              question: "Зачем нужен внешний запрос с WHERE rn = 1 после ROW_NUMBER?",
              options: [
                "Оконную функцию нельзя использовать напрямую в WHERE того же запроса",
                "Это просто стиль, можно и без него",
                "Чтобы ускорить запрос",
                "ROW_NUMBER работает только во вложенных запросах",
              ],
              correctIndex: 0,
              explain: "PostgreSQL считает оконные функции после WHERE, поэтому в том же SELECT фильтровать по rn нельзя — нужен внешний слой.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 5
    {
      id: "cte-i-podzaprosy",
      emoji: "🧩",
      title: "CTE и подзапросы: разбиваем сложное на простое",
      subtitle: "WITH ... AS — именованный черновик запроса",
      seedSql: SALES_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "WITH — сохрани промежуточный результат под именем",
          text: [
            "CTE (Common Table Expression, «именованное подвыражение») позволяет посчитать промежуточный результат один раз, дать ему имя и обращаться к нему в основном запросе, как к обычной таблице.",
            "Это делает сложные запросы читаемыми: вместо одного гигантского SELECT с кучей вложенных скобок — несколько понятных шагов.",
          ],
          code:
            "WITH region_totals AS (\n  SELECT region, SUM(amount) AS total\n  FROM sales\n  GROUP BY region\n)\nSELECT region, total\nFROM region_totals\nWHERE total > 2000\nORDER BY total DESC;",
          codeNote: "Сначала считаем сумму по регионам (это и есть region_totals), потом просто фильтруем результат.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "Подзапрос в WHERE — тоже своего рода вопрос внутри вопроса",
          text: [
            "Подзапрос можно поставить прямо в условие: например, сравнить каждую строку со средним значением по ВСЕЙ таблице, посчитанным отдельным `SELECT`.",
          ],
          code: "SELECT id, amount FROM sales\nWHERE amount > (SELECT AVG(amount) FROM sales)\nORDER BY amount DESC;",
          codeNote: "Внутренний SELECT считается один раз и превращается в число, с которым сравнивается каждая строка.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Регионы с оборотом больше 2000",
          story: [
            "С помощью CTE `region_totals` посчитай суммарные продажи по регионам, а во внешнем запросе оставь только те, где сумма больше 2000. Выведи `region` и `total`, отсортировав по убыванию суммы.",
          ],
          starterCode:
            "-- WITH region_totals AS (...) SELECT ... WHERE total > 2000\n",
          check: {
            codeContains: ["with", "as ("],
            expected: {
              orderMatters: true,
              columns: ["region", "total"],
              rows: [
                ["Москва", "5390"],
                ["Казань", "3780"],
              ],
            },
          },
          hints: [
            "`WITH region_totals AS (SELECT region, SUM(amount) AS total FROM sales GROUP BY region)`",
            "Дальше: `SELECT region, total FROM region_totals WHERE total > 2000 ORDER BY total DESC;`",
          ],
          solution:
            "WITH region_totals AS (\n  SELECT region, SUM(amount) AS total\n  FROM sales\n  GROUP BY region\n)\nSELECT region, total\nFROM region_totals\nWHERE total > 2000\nORDER BY total DESC;",
          xp: 30,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Продажи выше среднего",
          story: [
            "Найди все продажи, чья сумма БОЛЬШЕ среднего значения по всей таблице. Используй подзапрос `(SELECT AVG(amount) FROM sales)` прямо в условии WHERE. Выведи `id` и `amount`, от самой крупной к меньшей.",
          ],
          starterCode: "-- WHERE amount > (SELECT AVG(amount) FROM sales)\n",
          check: {
            codeContains: ["select avg"],
            expected: {
              orderMatters: true,
              columns: ["id", "amount"],
              rows: [
                ["5", "1600"],
                ["14", "1450"],
                ["12", "1340"],
                ["1", "1200"],
                ["7", "1100"],
                ["3", "980"],
              ],
            },
          },
          hints: [
            "Подзапрос ставится прямо в условие: `WHERE amount > (SELECT AVG(amount) FROM sales)`.",
            "Не забудь `ORDER BY amount DESC` в конце.",
          ],
          solution:
            "SELECT id, amount FROM sales\nWHERE amount > (SELECT AVG(amount) FROM sales)\nORDER BY amount DESC;",
          xp: 30,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Для чего используют CTE (WITH ... AS)?",
              options: [
                "Чтобы разбить сложный запрос на понятные именованные шаги",
                "Чтобы удалить временные данные",
                "Только для INSERT-запросов",
                "Чтобы ускорить любой запрос в 2 раза",
              ],
              correctIndex: 0,
              explain: "CTE — это про читаемость: промежуточный результат считается один раз и получает понятное имя.",
            },
            {
              question: "Что делает подзапрос (SELECT AVG(amount) FROM sales) внутри WHERE?",
              options: [
                "Считается один раз и превращается в число, с которым сравнивается каждая строка",
                "Заменяет всю таблицу sales",
                "Выполняется отдельно для каждой строки заново с нуля без оптимизации",
                "Работает только с ORDER BY",
              ],
              correctIndex: 0,
              explain: "Для такого простого агрегатного подзапроса PostgreSQL посчитает среднее один раз и будет сравнивать с ним.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 6
    {
      id: "raboty-s-datami",
      emoji: "📅",
      title: "Работа с датами: DATE_TRUNC и EXTRACT",
      subtitle: "Группируем и фильтруем по месяцам, дням, годам",
      seedSql: SALES_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "DATE_TRUNC — округлить дату «вниз»",
          text: [
            "`DATE_TRUNC('month', дата)` обрезает дату до начала месяца: `2024-03-24` становится `2024-03-01`. Это удобно группировать: все продажи марта получат одинаковое «округлённое» значение и склеятся в одну группу при `GROUP BY`.",
          ],
          code: "SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total\nFROM sales\nGROUP BY month\nORDER BY month;",
          codeNote: "Три строки результата — по одной на каждый месяц квартала.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "EXTRACT — достать часть даты как число",
          text: [
            "`EXTRACT(MONTH FROM дата)` возвращает номер месяца (1–12) как обычное число — удобно для условий `WHERE`. Так же работает `EXTRACT(YEAR FROM ...)`, `EXTRACT(DAY FROM ...)`.",
          ],
          code: "SELECT id, sale_date FROM sales\nWHERE EXTRACT(MONTH FROM sale_date) = 3;",
          codeNote: "Оставит только продажи, у которых месяц даты равен 3 (март).",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Выручка по месяцам",
          story: [
            "Посчитай суммарную выручку (`amount`) по месяцам с помощью `DATE_TRUNC('month', sale_date)`. Столбцы назови `month` и `total`, отсортируй по месяцу.",
          ],
          starterCode: "-- GROUP BY DATE_TRUNC('month', sale_date)\n",
          check: {
            codeContains: ["date_trunc"],
            expected: {
              orderMatters: true,
              columns: ["month", "total"],
              rows: [
                ["2024-01-01", "2840"],
                ["2024-02-01", "3640"],
                ["2024-03-01", "4650"],
              ],
            },
          },
          hints: [
            "`SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total FROM sales GROUP BY month ORDER BY month;`",
          ],
          solution:
            "SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total\nFROM sales\nGROUP BY month\nORDER BY month;",
          xp: 25,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Все продажи марта",
          story: [
            "Выведи `id`, `sale_date` и `amount` всех продаж, которые произошли в марте (месяц = 3), отсортировав по дате.",
          ],
          starterCode: "-- WHERE EXTRACT(MONTH FROM sale_date) = 3\n",
          check: {
            codeContains: ["extract"],
            expected: {
              orderMatters: true,
              columns: ["id", "sale_date", "amount"],
              rows: [
                ["10", "2024-03-02", "390"],
                ["11", "2024-03-09", "510"],
                ["12", "2024-03-15", "1340"],
                ["13", "2024-03-18", "260"],
                ["14", "2024-03-24", "1450"],
                ["15", "2024-03-29", "700"],
              ],
            },
          },
          hints: ["`WHERE EXTRACT(MONTH FROM sale_date) = 3`", "Не забудь `ORDER BY sale_date`."],
          solution:
            "SELECT id, sale_date, amount FROM sales\nWHERE EXTRACT(MONTH FROM sale_date) = 3\nORDER BY sale_date;",
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что делает DATE_TRUNC('month', '2024-03-24')?",
              options: ["Возвращает 2024-03-01", "Возвращает 03", "Возвращает 2024", "Удаляет дату"],
              correctIndex: 0,
              explain: "DATE_TRUNC обрезает дату до начала указанной единицы — в данном случае месяца.",
            },
            {
              question: "Что возвращает EXTRACT(MONTH FROM sale_date)?",
              options: ["Номер месяца как число (1–12)", "Название месяца текстом", "Целую дату", "Год"],
              correctIndex: 0,
              explain: "EXTRACT достаёт числовую часть даты — удобно для сравнений в WHERE.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 7
    {
      id: "svodnye-tablitsy",
      emoji: "🔄",
      title: "Сводные таблицы: CASE WHEN + GROUP BY",
      subtitle: "Превращаем значения строк в столбцы — pivot вручную",
      seedSql: SALES_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Pivot без специальной команды",
          text: [
            "В Excel есть сводные таблицы одним кликом. В обычном SQL их строят вручную приёмом `SUM(CASE WHEN условие THEN значение ELSE 0 END)` — по одному такому выражению на каждый будущий столбец.",
            "Идея: для каждой строки проверяем условие; если верно — берём сумму, если нет — 0. При GROUP BY нули не мешают, и в итоге в каждом столбце остаётся сумма только «своей» категории.",
          ],
          code:
            "SELECT category,\n  SUM(CASE WHEN region = 'Москва' THEN amount ELSE 0 END) AS moskva,\n  SUM(CASE WHEN region = 'Казань' THEN amount ELSE 0 END) AS kazan\nFROM sales\nGROUP BY category;",
          codeNote: "Строки исходной таблицы (регион как значение) превратились в столбцы результата.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Продажи по регионам и категориям",
          story: [
            "Построй сводную таблицу: строки — `category`, столбцы — суммы по трём регионам: `moskva` (Москва), `kazan` (Казань), `peterburg` (Петербург). Отсортируй по `category`.",
          ],
          starterCode:
            "-- SUM(CASE WHEN region = '...' THEN amount ELSE 0 END) AS ... для каждого региона\n",
          check: {
            codeContains: ["case when", "sum("],
            expected: {
              orderMatters: true,
              columns: ["category", "moskva", "kazan", "peterburg"],
              rows: [
                ["Книги", "180", "140", "470"],
                ["Одежда", "960", "1320", "390"],
                ["Электроника", "4250", "2320", "1100"],
              ],
            },
          },
          hints: [
            "Три выражения CASE WHEN — по одному на регион, каждое в своём SUM(...).",
            "`GROUP BY category ORDER BY category;` в конце.",
          ],
          solution:
            "SELECT category,\n  SUM(CASE WHEN region = 'Москва' THEN amount ELSE 0 END) AS moskva,\n  SUM(CASE WHEN region = 'Казань' THEN amount ELSE 0 END) AS kazan,\n  SUM(CASE WHEN region = 'Петербург' THEN amount ELSE 0 END) AS peterburg\nFROM sales\nGROUP BY category\nORDER BY category;",
          xp: 35,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Как работает SUM(CASE WHEN условие THEN значение ELSE 0 END)?",
              options: [
                "Складывает значение только там, где условие верно, а иначе добавляет 0",
                "Всегда складывает все значения без разбора",
                "Удаляет строки, где условие неверно",
                "Работает только с текстовыми столбцами",
              ],
              correctIndex: 0,
              explain: "Нули «не мешают» сумме, поэтому в столбце остаётся сумма только нужной группы.",
            },
            {
              question: "Что в pivot-запросе становится столбцами результата?",
              options: [
                "Значения, которые раньше были в отдельном столбце строк (например, регионы)",
                "Номера строк",
                "Названия таблиц",
                "Типы данных",
              ],
              correctIndex: 0,
              explain: "Это и есть суть pivot: превратить значения из столбца в отдельные столбцы результата.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 8
    {
      id: "join-tablic",
      emoji: "🔗",
      title: "JOIN двух таблиц: когда одной не хватает",
      subtitle: "Настоящие данные почти всегда лежат в разных таблицах",
      seedSql: SALES_SEED + MANAGERS_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "JOIN соединяет строки по совпадению",
          text: [
            "На практике данные редко лежат в одной таблице: продажи — в одной, менеджеры регионов — в другой, товары — в третьей. `JOIN` соединяет строки двух таблиц там, где совпадает указанное условие (`ON ...`).",
            "У каждой таблицы в запросе можно дать короткий псевдоним (`sales s`, `managers m`) — дальше на столбцы ссылаются как `s.amount`, `m.manager_name`.",
          ],
          code:
            "SELECT s.region, s.amount, m.manager_name\nFROM sales s\nJOIN managers m ON s.region = m.region\nORDER BY s.id\nLIMIT 3;",
          codeNote: "Для каждой продажи подставилось имя менеджера того региона, где эта продажа произошла.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "INNER JOIN теряет строки без пары, LEFT JOIN — нет",
          text: [
            "Обычный `JOIN` (он же `INNER JOIN`) оставляет только строки, для которых совпадение НАШЛОСЬ в обеих таблицах. Если у какого-то региона нет менеджера — продажи этого региона просто пропадут из результата.",
            "`LEFT JOIN` — мягче: оставляет ВСЕ строки левой таблицы, а там, где пары справа не нашлось, подставляет `NULL` вместо значений правой таблицы.",
          ],
          code:
            "-- INNER JOIN: регион без менеджера исчезает из результата\nSELECT DISTINCT region FROM sales s JOIN managers m ON s.region = m.region;\n\n-- LEFT JOIN: показывает все регионы, даже без менеджера (NULL)\nSELECT DISTINCT region FROM sales s LEFT JOIN managers m ON s.region = m.region;",
          codeNote: "В таблице managers нет строки для Петербурга — первый запрос его не покажет, второй покажет с NULL.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Выручка по менеджерам",
          story: [
            "В таблице `managers` у каждого региона есть ответственный менеджер (кроме Петербурга — там пока никого не назначили). Посчитай суммарную выручку (`amount`) по каждому менеджеру: соедини `sales` и `managers` по `region`, сгруппируй по `manager_name`. Столбцы — `manager_name` и `total`, отсортируй по имени менеджера.",
          ],
          starterCode: "-- JOIN sales и managers по region, GROUP BY manager_name\n",
          check: {
            codeContains: ["join", "sum("],
            expected: {
              orderMatters: true,
              columns: ["manager_name", "total"],
              rows: [
                ["Ирина Соколова", "5390"],
                ["Олег Петров", "3780"],
              ],
            },
          },
          hints: [
            "`FROM sales s JOIN managers m ON s.region = m.region` — соединение по совпадающему региону.",
            "Дальше как обычно: `GROUP BY m.manager_name ORDER BY m.manager_name;`. Обрати внимание — Петербурга в результате не будет: у него нет менеджера, а обычный JOIN такие строки отбрасывает.",
          ],
          solution:
            "SELECT m.manager_name, SUM(s.amount) AS total\nFROM sales s\nJOIN managers m ON s.region = m.region\nGROUP BY m.manager_name\nORDER BY m.manager_name;",
          xp: 30,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Все регионы, даже без менеджера",
          story: [
            "Теперь выведи ВСЕ регионы, которые встречаются в продажах, вместе с именем менеджера — а если менеджера нет, пусть в результате будет `NULL`. Используй `LEFT JOIN`, выведи различающиеся (`DISTINCT`) `region` и `manager_name`, отсортировав по `region`.",
          ],
          starterCode: "-- LEFT JOIN sales и managers, DISTINCT region\n",
          check: {
            codeContains: ["left join", "distinct"],
            expected: {
              orderMatters: true,
              columns: ["region", "manager_name"],
              rows: [
                ["Казань", "Олег Петров"],
                ["Москва", "Ирина Соколова"],
                ["Петербург", "NULL"],
              ],
            },
          },
          hints: [
            "`SELECT DISTINCT s.region, m.manager_name FROM sales s LEFT JOIN managers m ON s.region = m.region`.",
            "`ORDER BY s.region;` в конце — и не забудь DISTINCT, иначе строк будет больше (по одной на каждую продажу, а не на регион).",
          ],
          solution:
            "SELECT DISTINCT s.region, m.manager_name\nFROM sales s\nLEFT JOIN managers m ON s.region = m.region\nORDER BY s.region;",
          xp: 30,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что произойдёт со строкой левой таблицы при INNER JOIN, если для неё не нашлось пары в правой?",
              options: [
                "Она пропадёт из результата",
                "Она останется, но с NULL вместо значений правой таблицы",
                "Запрос завершится ошибкой",
                "Она продублируется",
              ],
              correctIndex: 0,
              explain: "INNER JOIN (обычный JOIN) оставляет только строки, у которых совпадение нашлось в обеих таблицах.",
            },
            {
              question: "Чем LEFT JOIN отличается от INNER JOIN?",
              options: [
                "LEFT JOIN сохраняет все строки левой таблицы, подставляя NULL, если пары справа не нашлось",
                "LEFT JOIN работает только с числами",
                "Разницы нет, это синонимы",
                "LEFT JOIN всегда возвращает меньше строк, чем INNER JOIN",
              ],
              correctIndex: 0,
              explain: "Это и есть смысл LEFT JOIN — «не терять» строки левой таблицы, даже без пары справа.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 9
    {
      id: "lag-lead-rost",
      emoji: "📈",
      title: "LAG и LEAD: сравниваем период с предыдущим",
      subtitle: "Оконная функция, которая «смотрит» на соседнюю строку",
      seedSql: SALES_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "LAG — значение из предыдущей строки окна",
          text: [
            "`LAG(столбец) OVER (ORDER BY ...)` возвращает значение того же столбца, но из предыдущей строки (по заданному порядку). Это ровно то, что нужно, чтобы сравнить текущий месяц с прошлым, не выгружая данные в Excel.",
            "У `LEAD(столбец) OVER (...)` то же самое, но в обратную сторону — она «заглядывает» в СЛЕДУЮЩУЮ строку.",
          ],
          code:
            "WITH monthly AS (\n  SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total\n  FROM sales GROUP BY month\n)\nSELECT month, total,\n  LAG(total) OVER (ORDER BY month) AS prev_month\nFROM monthly\nORDER BY month;",
          codeNote: "У первого месяца prev_month — NULL: строки перед ним просто не существует.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "Процент роста относительно прошлого периода",
          text: [
            "Комбинируя `LAG` с обычной арифметикой, легко получить любимую метрику любого отчёта — процент роста: `(текущий − прошлый) / прошлый * 100`.",
          ],
          code:
            "SELECT month, total,\n  ROUND(100.0 * (total - LAG(total) OVER (ORDER BY month)) / LAG(total) OVER (ORDER BY month), 1) AS growth_pct\nFROM monthly\nORDER BY month;",
          codeNote: "У первого месяца growth_pct тоже NULL — не с чем сравнивать, прошлого периода не существует.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Выручка месяц к месяцу",
          story: [
            "Для каждого месяца выведи суммарную выручку (`total`) и выручку предыдущего месяца (`prev_month`) с помощью `LAG`. Столбцы: `month`, `total`, `prev_month`.",
          ],
          starterCode:
            "-- WITH monthly AS (...) SELECT month, total, LAG(total) OVER (ORDER BY month) AS prev_month FROM monthly ORDER BY month;\nWITH monthly AS (\n  SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total\n  FROM sales GROUP BY month\n)\nSELECT month, total,\n  LAG(total) OVER (ORDER BY month) AS prev_month\nFROM monthly\nORDER BY month;\n",
          check: {
            codeContains: ["lag("],
            expected: {
              orderMatters: true,
              columns: ["month", "total", "prev_month"],
              rows: [
                ["2024-01-01", "2840", "NULL"],
                ["2024-02-01", "3640", "2840"],
                ["2024-03-01", "4650", "3640"],
              ],
            },
          },
          hints: [
            "Заготовка кода уже готова — просто запусти её и посмотри на результат!",
            "LAG(total) OVER (ORDER BY month) на каждой строке подставляет total из предыдущей строки этого же результата.",
          ],
          solution:
            "WITH monthly AS (\n  SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total\n  FROM sales GROUP BY month\n)\nSELECT month, total,\n  LAG(total) OVER (ORDER BY month) AS prev_month\nFROM monthly\nORDER BY month;",
          xp: 30,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Процент роста по месяцам",
          story: [
            "Теперь посчитай `growth_pct` — процент роста выручки относительно предыдущего месяца, округлённый до одного знака: `ROUND(100.0 * (total - prev) / prev, 1)`, где `prev` — это `LAG(total) OVER (ORDER BY month)`. Столбцы: `month`, `total`, `growth_pct`.",
          ],
          starterCode: "-- WITH monthly AS (...) + ROUND(100.0 * (total - LAG(total) OVER (...)) / LAG(total) OVER (...), 1)\n",
          check: {
            codeContains: ["lag(", "round("],
            expected: {
              orderMatters: true,
              columns: ["month", "total", "growth_pct"],
              rows: [
                ["2024-01-01", "2840", "NULL"],
                ["2024-02-01", "3640", "28.2"],
                ["2024-03-01", "4650", "27.7"],
              ],
            },
          },
          hints: [
            "LAG(total) OVER (ORDER BY month) придётся написать два раза — один раз в числителе разности, один раз в знаменателе.",
            "У первого месяца growth_pct будет NULL — это нормально, прошлого периода для него не существует.",
          ],
          solution:
            "WITH monthly AS (\n  SELECT DATE_TRUNC('month', sale_date) AS month, SUM(amount) AS total\n  FROM sales GROUP BY month\n)\nSELECT month, total,\n  ROUND(100.0 * (total - LAG(total) OVER (ORDER BY month)) / LAG(total) OVER (ORDER BY month), 1) AS growth_pct\nFROM monthly\nORDER BY month;",
          xp: 35,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что вернёт LAG(total) OVER (ORDER BY month) для самой первой строки?",
              options: [
                "NULL — предыдущей строки не существует",
                "0",
                "Значение последней строки",
                "Ошибку выполнения",
              ],
              correctIndex: 0,
              explain: "Для первой строки в заданном порядке предыдущей строки просто нет — LAG честно возвращает NULL.",
            },
            {
              question: "Чем LEAD отличается от LAG?",
              options: [
                "LEAD смотрит на следующую строку окна, LAG — на предыдущую",
                "LEAD работает только с текстом",
                "Это два названия одной и той же функции",
                "LEAD нельзя использовать с ORDER BY",
              ],
              correctIndex: 0,
              explain: "LAG и LEAD — зеркальные функции: одна оглядывается назад, другая заглядывает вперёд.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 10
    {
      id: "having-i-ochistka",
      emoji: "🧹",
      title: "HAVING и очистка данных: TRIM, LOWER, COALESCE",
      subtitle: "Настоящие данные почти всегда «грязные»",
      seedSql: FEEDBACK_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Один человек — три разных строки",
          text: [
            "В таблице `feedback` один и тот же покупатель может встречаться как `'Анна'`, `'  Анна  '` (с пробелами) и `'АННА'` (другой регистр) — это НЕ три разных человека, а один, просто данные ввели по-разному.",
            "`TRIM(текст)` убирает пробелы по краям, `LOWER(текст)` приводит к нижнему регистру. Вместе они «нормализуют» текст перед сравнением или группировкой.",
            "`HAVING` — это `WHERE`, но для ПОСЛЕ группировки: в нём, в отличие от `WHERE`, можно использовать агрегатные функции вроде `COUNT(*)`.",
          ],
          code:
            "SELECT TRIM(LOWER(customer_name)) AS name, COUNT(*) AS reviews\nFROM feedback\nGROUP BY TRIM(LOWER(customer_name))\nHAVING COUNT(*) > 1\nORDER BY name;",
          codeNote: "«  Анна  », «Анна» и «АННА» после нормализации — одна и та же строка 'анна', поэтому склеились в одну группу.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "COALESCE — замена NULL на значение по умолчанию",
          text: [
            "`COALESCE(значение, запасное_значение)` возвращает первое НЕ-NULL из списка. Проще говоря: «если значение есть — верни его, если NULL — верни вот это вместо него».",
          ],
          code:
            "SELECT customer_name, COALESCE(email, 'нет email') AS email\nFROM feedback\nORDER BY id;",
          codeNote: "Там, где email указан — он и выводится. Там, где в базе NULL — подставляется текст 'нет email'.",
        },
        {
          kind: "sql-task",
          id: "z1",
          title: "Кто написал больше одного отзыва?",
          story: [
            "Найди покупателей, оставивших больше одного отзыва — учитывая, что имя может быть записано с разным регистром и пробелами. Сгруппируй по `TRIM(LOWER(customer_name))` и оставь через `HAVING` только тех, у кого `COUNT(*) > 1`. Столбцы: `name`, `reviews`.",
          ],
          starterCode: "-- GROUP BY TRIM(LOWER(customer_name)) + HAVING COUNT(*) > 1\n",
          check: {
            codeContains: ["having", "trim", "lower"],
            expected: { columns: ["name", "reviews"], rows: [["анна", "3"]] },
          },
          hints: [
            "Группируй именно по нормализованному выражению: `GROUP BY TRIM(LOWER(customer_name))`.",
            "`HAVING COUNT(*) > 1` — фильтр применяется уже к посчитанным группам, а не к отдельным строкам.",
          ],
          solution:
            "SELECT TRIM(LOWER(customer_name)) AS name, COUNT(*) AS reviews\nFROM feedback\nGROUP BY TRIM(LOWER(customer_name))\nHAVING COUNT(*) > 1\nORDER BY name;",
          xp: 30,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Покупатели без почты",
          story: [
            "Найди все отзывы, где `email` не указан (`NULL`). Вместо `NULL` выведи через `COALESCE` текст `'нет email'`. Столбцы: `name` (имя через `TRIM`, без пробелов по краям) и `email`, отсортировав по `id`.",
          ],
          starterCode: "-- WHERE email IS NULL + COALESCE(email, 'нет email')\n",
          check: {
            codeContains: ["coalesce", "is null"],
            expected: {
              orderMatters: true,
              columns: ["name", "email"],
              rows: [
                ["борис", "нет email"],
                ["АННА", "нет email"],
              ],
            },
          },
          hints: [
            "`WHERE email IS NULL` — сравнение с NULL через `=` не работает, нужно именно `IS NULL`.",
            "`SELECT TRIM(customer_name) AS name, COALESCE(email, 'нет email') AS email FROM feedback WHERE email IS NULL ORDER BY id;`",
          ],
          solution:
            "SELECT TRIM(customer_name) AS name, COALESCE(email, 'нет email') AS email\nFROM feedback\nWHERE email IS NULL\nORDER BY id;",
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Почему TRIM(LOWER(customer_name)) склеивает «Анна», «  Анна  » и «АННА» в одну группу?",
              options: [
                "После обрезки пробелов и приведения к нижнему регистру все три строки становятся одинаковыми",
                "SQL сам определяет, что это один человек, по смыслу",
                "Это работает только с именами длиннее 5 символов",
                "На самом деле группа не склеивается, это ошибка",
              ],
              correctIndex: 0,
              explain: "TRIM убирает пробелы, LOWER убирает разницу в регистре — после этого строки текстово совпадают.",
            },
            {
              question: "Чем HAVING отличается от WHERE?",
              options: [
                "HAVING фильтрует ПОСЛЕ группировки и может использовать агрегатные функции (COUNT, SUM...)",
                "HAVING работает только с датами",
                "Это два названия одного и того же",
                "WHERE может использовать COUNT(*), а HAVING — нет",
              ],
              correctIndex: 0,
              explain: "WHERE отсекает строки до GROUP BY, а агрегаты в нём ещё не посчитаны — поэтому фильтр по ним ставят в HAVING.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 11
    {
      id: "final-keys-analitika",
      emoji: "🏁",
      title: "Финальный кейс аналитика",
      subtitle: "Собери отчёт для руководителя, используя всё, что узнал",
      seedSql: SALES_SEED,
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Настоящий кейс",
          text: [
            "Руководитель просит два числа для квартального отчёта: на сколько процентов выросла выручка от января к марту, и какая категория товаров принесла больше всего денег за квартал.",
            "Ты уже знаешь всё необходимое: `statistics` для расчётов в Python, `WITH` и оконные функции для ранжирования в SQL.",
          ],
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Рост выручки за квартал",
          story: [
            "Выручка по месяцам (посчитана в уроке 6): `[2840, 3640, 4650]` — январь, февраль, март. Посчитай процент роста от первого месяца к последнему по формуле `(последний - первый) / первый * 100`, округли и напечатай в формате `Рост за квартал: 64%`. Второй строкой напечатай округлённое среднемесячное значение выручки.",
          ],
          starterCode:
            "import statistics\n\nrevenue_by_month = [2840, 3640, 4650]\n# процент роста и среднее\n",
          check: {
            expectedOutput: "Рост за квартал: 64%\n3710",
            codeContains: ["statistics.mean", "revenue_by_month[-1]"],
          },
          hints: [
            "Рост: `growth = round((revenue_by_month[-1] - revenue_by_month[0]) / revenue_by_month[0] * 100)`.",
            'Печать: `print(f"Рост за квартал: {growth}%")`, потом `print(round(statistics.mean(revenue_by_month)))`.',
          ],
          solution:
            'import statistics\n\nrevenue_by_month = [2840, 3640, 4650]\ngrowth = round((revenue_by_month[-1] - revenue_by_month[0]) / revenue_by_month[0] * 100)\nprint(f"Рост за квартал: {growth}%")\nprint(round(statistics.mean(revenue_by_month)))',
          xp: 30,
        },
        {
          kind: "sql-task",
          id: "z2",
          title: "Категория-лидер квартала",
          story: [
            "Найди категорию товаров с наибольшей суммарной выручкой за весь квартал. Посчитай суммы по категориям через CTE, затем присвой ранг через `RANK() OVER (ORDER BY total DESC)` и оставь только строку с рангом 1. Выведи `category` и `total`.",
          ],
          starterCode:
            "-- CTE с суммами по категориям, потом RANK() OVER (...) и фильтр rnk = 1\n",
          check: {
            codeContains: ["with", "rank() over"],
            expected: { columns: ["category", "total"], rows: [["Электроника", "7670"]] },
          },
          hints: [
            "Сначала CTE: `WITH cat_totals AS (SELECT category, SUM(amount) AS total FROM sales GROUP BY category)`.",
            "Потом вложенный запрос с `RANK() OVER (ORDER BY total DESC) AS rnk`, а во внешнем — `WHERE rnk = 1`.",
          ],
          solution:
            "WITH cat_totals AS (\n  SELECT category, SUM(amount) AS total FROM sales GROUP BY category\n)\nSELECT category, total FROM (\n  SELECT category, total, RANK() OVER (ORDER BY total DESC) AS rnk FROM cat_totals\n) t\nWHERE rnk = 1;",
          xp: 35,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Экзамен аналитика",
          xp: 15,
          questions: [
            {
              question: "Когда медиана предпочтительнее среднего для описания «типичного» значения?",
              options: [
                "Когда в данных есть выбросы — очень большие или очень маленькие значения",
                "Всегда, среднее вообще не нужно",
                "Только для чётного количества значений",
                "Никогда, среднее всегда лучше",
              ],
              correctIndex: 0,
              explain: "Медиана устойчива к выбросам — одно аномальное значение почти не сдвигает её.",
            },
            {
              question: "Зачем в pivot-запросе используют SUM(CASE WHEN ... THEN ... ELSE 0 END)?",
              options: [
                "Чтобы превратить значения строк в отдельные столбцы результата",
                "Чтобы удалить дубликаты",
                "Чтобы посчитать среднее",
                "Чтобы отсортировать таблицу",
              ],
              correctIndex: 0,
              explain: "Это и есть суть сводной таблицы: превратить значения одного столбца в набор столбцов.",
            },
            {
              question: "Что общего у ROW_NUMBER() и RANK() при использовании с PARTITION BY?",
              options: [
                "Обе нумеруют строки внутри каждой группы, не склеивая строки в одну (в отличие от GROUP BY)",
                "Обе удаляют дубликаты",
                "Обе работают только с датами",
                "Обе требуют CTE",
              ],
              correctIndex: 0,
              explain: "Разница между ними — в обработке равных значений (RANK может давать одинаковый ранг), но общий принцип — оконная нумерация без склейки строк.",
            },
          ],
        },
      ],
    },
  ],
};
