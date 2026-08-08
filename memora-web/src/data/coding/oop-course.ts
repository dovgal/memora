// ⚔️ Трек «ООП на Python» — 8 уроков.
// Рассчитан на тех, кто уже прошёл базовый Python-трек (переменные, циклы,
// функции) и хочет разобраться с объектно-ориентированным программированием:
// классы, методы, инкапсуляция, наследование, полиморфизм, магические методы.
// Сквозной сюжет: отряд героев готовится к финальному походу.

import type { Track } from "./types";

export const oopTrack: Track = {
  id: "oop",
  emoji: "⚔️",
  title: "ООП на Python",
  tagline: "От функций и словарей — к классам и объектам",
  color: "orange",
  intro: [
    "Этот трек рассчитан на тех, кто уже знает основы Python (переменные, `if`, циклы, функции) — например, прошёл трек «Академия юных кодеров» — и готов к следующему шагу: объектно-ориентированному программированию (ООП).",
    "ООП — это способ организовать код вокруг объектов: у каждого объекта есть свои данные (атрибуты) и свои действия (методы). Вместо кучи отдельных переменных `hero_name`, `hero_hp`, `hero_mana` — один объект `hero`, который «знает» всё о себе сам.",
    "Сквозной пример трека: отряд героев готовится к решающему походу. К финалу ты соберёшь целую систему классов — с наследованием, инкапсуляцией и полиморфизмом.",
  ],
  finalBadge: { id: "track-oop", emoji: "🛡️", title: "Архитектор классов: весь трек пройден!" },
  lessons: [
    // ────────────────────────────────────────────────────────── Урок 1
    {
      id: "ot-slovarya-k-klassu",
      emoji: "🏗️",
      title: "От словаря к классу",
      subtitle: "Зачем нужны классы, если есть словари",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Проблема повторения",
          text: [
            "Раньше, чтобы описать героя, ты, наверное, делал бы что-то вроде `hero_name = \"Мила\"`, `hero_hp = 100` — и повторял это для каждого нового героя. Неудобно и легко ошибиться.",
            "Класс — это шаблон («чертёж») для создания объектов. Он описывается один раз, а объекты («экземпляры») создаются из него сколько угодно раз, каждый со своими значениями.",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\nwarrior = Hero("Мила", 100)\nprint(warrior.name)\nprint(warrior.hp)',
          codeNote: "`__init__` — специальный метод-«конструктор»: он запускается автоматически при создании объекта.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "self — это «я сам»",
          text: [
            "`self` — первый параметр каждого метода класса, он означает «этот конкретный объект». Когда ты пишешь `self.name = name`, ты говоришь: «у ЭТОГО героя атрибут name равен значению параметра name».",
            "`self` не пишется при вызове (`Hero(\"Мила\", 100)`, а не `Hero(self, \"Мила\", 100)`) — Python подставляет его сам.",
          ],
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Первый герой отряда",
          story: [
            "Создай класс `Hero` с методом `__init__(self, name, hp)`, который сохраняет `name` и `hp` в атрибуты объекта. Создай героя с именем `Рекс` и здоровьем `120`, напечатай его имя, потом здоровье.",
          ],
          starterCode: "# class Hero: ...\n",
          check: { expectedOutput: "Рекс\n120", codeContains: ["class Hero", "__init__", "self."] },
          hints: [
            "`class Hero:` затем с отступом `def __init__(self, name, hp):`.",
            "Внутри: `self.name = name` и `self.hp = hp`.",
            'Создание: `rex = Hero("Рекс", 120)`, затем `print(rex.name)` и `print(rex.hp)`.',
          ],
          solution: 'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\nrex = Hero("Рекс", 120)\nprint(rex.name)\nprint(rex.hp)',
          xp: 25,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Отряд из двух героев",
          story: [
            "Тот же класс `Hero` — но теперь создай ДВУХ героев: `Мила` со здоровьем `100` и `Глеб` со здоровьем `90`. Напечатай имя первого, потом имя второго.",
          ],
          starterCode: "class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n# создай двух героев и напечатай их имена\n",
          check: { expectedOutput: "Мила\nГлеб" },
          hints: [
            '`h1 = Hero("Мила", 100)` и `h2 = Hero("Глеб", 90)`.',
            "У каждого объекта свои собственные атрибуты — они не мешают друг другу.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\nh1 = Hero("Мила", 100)\nh2 = Hero("Глеб", 90)\nprint(h1.name)\nprint(h2.name)',
          xp: 20,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что такое класс?",
              options: [
                "Шаблон («чертёж»), по которому создаются объекты",
                "Готовый объект",
                "Синоним переменной",
                "Специальный тип числа",
              ],
              correctIndex: 0,
              explain: "Класс описывается один раз, а объекты по этому шаблону можно создавать сколько угодно.",
            },
            {
              question: "Когда вызывается метод __init__?",
              options: [
                "Автоматически, при создании нового объекта",
                "Только если его вызвать вручную",
                "Каждый раз при печати объекта",
                "Никогда, это просто название",
              ],
              correctIndex: 0,
              explain: "__init__ — «конструктор»: он настраивает объект сразу в момент создания.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 2
    {
      id: "metody-i-self",
      emoji: "⚙️",
      title: "Методы: self и действия объекта",
      subtitle: "У объектов есть не только данные, но и поведение",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Метод — это функция внутри класса",
          text: [
            "Метод выглядит как обычная функция, только живёт внутри класса и первым параметром всегда принимает `self` — доступ к атрибутам ТЕКУЩЕГО объекта.",
            "Вызывается через точку: `warrior.attack()` — а не `attack(warrior)`, хотя внутри метода `self` и есть тот самый `warrior`.",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def attack(self):\n        print(f"{self.name} атакует!")\n\nh = Hero("Мила", 100)\nh.attack()',
          codeNote: "Внутри attack() self.name — это имя ИМЕННО того героя, для которого метод был вызван.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "Метод может возвращать значение",
          text: [
            "Как и обычная функция, метод может использовать `return`. Например, проверить условие и вернуть `True`/`False`.",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def is_alive(self):\n        return self.hp > 0\n\nh = Hero("Мила", 100)\nprint(h.is_alive())',
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Клич атаки",
          story: [
            "Добавь классу `Hero` метод `attack(self)`, который печатает `Имя атакует!` (например, `Мила атакует!`). Создай героя `Мила` с здоровьем `100` и вызови у него `attack()`.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    # добавь метод attack\n\nh = Hero("Мила", 100)\n# вызови attack\n',
          check: { expectedOutput: "Мила атакует!", codeContains: ["def attack(self)"] },
          hints: [
            '`def attack(self):` с отступом внутри класса, а внутри метода — `print(f"{self.name} атакует!")`.',
            "Вызов: `h.attack()`.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def attack(self):\n        print(f"{self.name} атакует!")\n\nh = Hero("Мила", 100)\nh.attack()',
          xp: 25,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Жив ли герой?",
          story: [
            "Добавь классу `Hero` метод `is_alive(self)`, возвращающий `True`, если `hp > 0`, иначе `False`. Создай героя со здоровьем `0` и напечатай результат `is_alive()`.",
          ],
          starterCode:
            "class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    # добавь метод is_alive\n\nh = Hero(\"Зомби\", 0)\n# напечатай is_alive()\n",
          check: { expectedOutput: "False", codeContains: ["def is_alive(self)", "return"] },
          hints: [
            "`def is_alive(self): return self.hp > 0`",
            "`print(h.is_alive())`",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def is_alive(self):\n        return self.hp > 0\n\nh = Hero("Зомби", 0)\nprint(h.is_alive())',
          xp: 20,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Как вызвать метод attack у объекта h?",
              options: ["`h.attack()`", "`attack(h)`", "`Hero.attack`", "`h->attack()`"],
              correctIndex: 0,
              explain: "Методы вызываются через точку после объекта — Python сам передаёт объект как self.",
            },
            {
              question: "Что такое self внутри метода?",
              options: [
                "Ссылка на тот конкретный объект, для которого метод был вызван",
                "Имя класса",
                "Название метода",
                "Служебное слово, которое ничего не делает",
              ],
              correctIndex: 0,
              explain: "self — это и есть «текущий объект», через него метод достаёт его атрибуты.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 3
    {
      id: "izmenenie-sostoyaniya",
      emoji: "💥",
      title: "Изменение состояния объекта",
      subtitle: "Методы, которые не просто читают, а меняют атрибуты",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Объект можно изменить изнутри метода",
          text: [
            "Метод может не только читать `self.атрибут`, но и присваивать ему новое значение. После вызова такого метода объект меняется «навсегда» (пока ты не поменяешь его снова).",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def take_damage(self, amount):\n        self.hp = self.hp - amount\n\nh = Hero("Мила", 100)\nh.take_damage(30)\nprint(h.hp)',
          codeNote: "После вызова take_damage(30) health объекта h изменился с 100 до 70 — и остаётся таким.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Урон в бою",
          story: [
            "Добавь классу `Hero` метод `take_damage(self, amount)`, уменьшающий `self.hp` на `amount`. Создай героя со здоровьем `100`, нанеси ему урон `30`, затем ещё `45`. Напечатай итоговое здоровье.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    # добавь take_damage\n\nh = Hero("Мила", 100)\n# два удара: 30 и 45, потом печать hp\n',
          check: { expectedOutput: "25", codeContains: ["def take_damage"] },
          hints: [
            "`def take_damage(self, amount): self.hp = self.hp - amount`",
            "`h.take_damage(30)`, потом `h.take_damage(45)`, потом `print(h.hp)`.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def take_damage(self, amount):\n        self.hp = self.hp - amount\n\nh = Hero("Мила", 100)\nh.take_damage(30)\nh.take_damage(45)\nprint(h.hp)',
          xp: 25,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Лечение",
          story: [
            "Добавь ещё метод `heal(self, amount)`, увеличивающий `self.hp` на `amount`. Начни со здоровья `50`, нанеси урон `40`, потом вылечи на `25`. Напечатай итоговое здоровье.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def take_damage(self, amount):\n        self.hp = self.hp - amount\n\n    # добавь heal\n\nh = Hero("Глеб", 50)\n# урон 40, потом лечение 25, потом печать hp\n',
          check: { expectedOutput: "35", codeContains: ["def heal"] },
          hints: [
            "`def heal(self, amount): self.hp = self.hp + amount`",
            "50 − 40 + 25 = 35.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def take_damage(self, amount):\n        self.hp = self.hp - amount\n\n    def heal(self, amount):\n        self.hp = self.hp + amount\n\nh = Hero("Глеб", 50)\nh.take_damage(40)\nh.heal(25)\nprint(h.hp)',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что произойдёт с объектом после вызова метода, который меняет self.hp?",
              options: [
                "Объект изменится и останется таким до следующего изменения",
                "Изменение исчезнет сразу после завершения метода",
                "Изменится только копия объекта",
                "Ничего, self.hp менять нельзя",
              ],
              correctIndex: 0,
              explain: "self — это сам объект, а не его копия. Изменения атрибутов сохраняются.",
            },
            {
              question: "Как в методе take_damage(self, amount) уменьшить здоровье?",
              options: ["`self.hp = self.hp - amount`", "`hp = hp - amount`", "`self.hp -= self`", "`amount.hp -= self`"],
              correctIndex: 0,
              explain: "Нужно явно обратиться к атрибуту через self и присвоить ему новое значение.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 4
    {
      id: "inkapsulyatsiya",
      emoji: "🔒",
      title: "Инкапсуляция: свойства и защита данных",
      subtitle: "Не позволяем здоровью стать отрицательным",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Проблема прямого доступа",
          text: [
            "Если `self.hp` можно менять напрямую откуда угодно, ничего не мешает случайно записать туда `-9999` или строку вместо числа. Инкапсуляция — это идея «прятать» внутреннее устройство объекта и давать доступ только через контролируемые методы.",
            "По соглашению имя с подчёркиванием впереди (`self._hp`) означает «это внутреннее, снаружи трогать не нужно», хотя Python технически не запрещает.",
          ],
        },
        {
          kind: "theory",
          id: "t2",
          title: "@property — контролируемый доступ",
          text: [
            "`@property` превращает метод в «вычисляемый атрибут» — снаружи выглядит как обычное поле (`hero.hp`), а внутри может делать проверки. `@hp.setter` — аналогично, но для присваивания (`hero.hp = -50`).",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self._hp = hp\n\n    @property\n    def hp(self):\n        return max(0, self._hp)\n\n    @hp.setter\n    def hp(self, value):\n        self._hp = value\n\nh = Hero("Мила", 20)\nh.hp = -50\nprint(h.hp)',
          codeNote: "Снаружи мы просто читаем h.hp — но property гарантирует, что оно никогда не будет отрицательным.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Здоровье не может быть отрицательным",
          story: [
            "Перепиши класс `Hero` так, чтобы хранить здоровье в `self._hp`, а через `@property hp` всегда отдавать `max(0, self._hp)`. Создай героя со здоровьем `20`, установи `h.hp = -50` и напечатай `h.hp`.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self._hp = hp\n\n    # добавь property hp с getter и setter\n\nh = Hero("Мила", 20)\nh.hp = -50\nprint(h.hp)\n',
          check: { expectedOutput: "0", codeContains: ["@property", "@hp.setter"] },
          hints: [
            "Getter: `@property` затем `def hp(self): return max(0, self._hp)`.",
            "Setter: `@hp.setter` затем `def hp(self, value): self._hp = value`.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self._hp = hp\n\n    @property\n    def hp(self):\n        return max(0, self._hp)\n\n    @hp.setter\n    def hp(self, value):\n        self._hp = value\n\nh = Hero("Мила", 20)\nh.hp = -50\nprint(h.hp)',
          xp: 30,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Максимум здоровья",
          story: [
            "Усложни setter: здоровье не должно превышать `max_hp = 100`. Если пытаются установить больше — сохраняй `100`. Установи `h.hp = 500` и напечатай `h.hp`.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self._hp = hp\n\n    @property\n    def hp(self):\n        return max(0, self._hp)\n\n    @hp.setter\n    def hp(self, value):\n        # ограничь сверху значением 100\n        self._hp = value\n\nh = Hero("Мила", 20)\nh.hp = 500\nprint(h.hp)\n',
          check: { expectedOutput: "100", codeContains: ["min("] },
          hints: [
            "В setter используй `self._hp = min(value, 100)`.",
            "min() выбирает меньшее из двух чисел — то, что и нужно для верхнего предела.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self._hp = hp\n\n    @property\n    def hp(self):\n        return max(0, self._hp)\n\n    @hp.setter\n    def hp(self, value):\n        self._hp = min(value, 100)\n\nh = Hero("Мила", 20)\nh.hp = 500\nprint(h.hp)',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что означает подчёркивание перед именем атрибута, например _hp?",
              options: [
                "По соглашению — «это внутреннее, снаружи менять напрямую не стоит»",
                "Атрибут удалён",
                "Атрибут — это число, а не строка",
                "Ничего не означает",
              ],
              correctIndex: 0,
              explain: "Это соглашение сообщества Python, а не строгий запрет — но нарушать его не стоит.",
            },
            {
              question: "Зачем нужен @property?",
              options: [
                "Дать снаружи доступ как к обычному атрибуту, но с проверками внутри",
                "Ускорить выполнение кода",
                "Сделать метод недоступным",
                "Превратить класс в функцию",
              ],
              correctIndex: 0,
              explain: "property позволяет писать h.hp вместо h.get_hp(), сохраняя контроль над значением.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 5
    {
      id: "nasledovanie",
      emoji: "🧬",
      title: "Наследование: класс от класса",
      subtitle: "Не повторяй код — расширяй существующий класс",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Дочерний класс получает всё родительское",
          text: [
            "`class Mage(Hero):` означает «Mage — это Hero, но с дополнениями». Всё, что умеет `Hero` (атрибуты, методы), автоматически есть и у `Mage` — не нужно копировать код.",
            "`super().__init__(...)` вызывает конструктор родительского класса — это способ сказать «сначала настрой меня как обычного Hero, а потом добавь моё дополнительное».",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\nclass Mage(Hero):\n    def __init__(self, name, hp, mana):\n        super().__init__(name, hp)\n        self.mana = mana\n\nm = Mage("Лея", 80, 50)\nprint(m.name)\nprint(m.mana)',
          codeNote: "Mage получил name и hp «бесплатно» от Hero, и добавил своё — mana.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "Переопределение метода",
          text: [
            "Дочерний класс может ЗАМЕНИТЬ метод родителя, написав метод с тем же именем. Это называется переопределением (override) — и это первый шаг к полиморфизму, о котором в следующем уроке.",
          ],
          code:
            'class Hero:\n    def attack(self):\n        print("Обычная атака!")\n\nclass Mage(Hero):\n    def attack(self):\n        print("Огненный шар!")\n\nMage().attack()',
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Маг с запасом маны",
          story: [
            "Есть класс `Hero` с `name` и `hp`. Создай `Mage(Hero)` с дополнительным атрибутом `mana`, используя `super().__init__()` для настройки `name` и `hp`. Создай маг `Лея`, здоровье `80`, мана `50`. Напечатай имя, потом ману.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n# создай class Mage(Hero) с mana\n\nm = Mage("Лея", 80, 50)\nprint(m.name)\nprint(m.mana)\n',
          check: { expectedOutput: "Лея\n50", codeContains: ["class Mage(Hero)", "super()"] },
          hints: [
            "`class Mage(Hero): def __init__(self, name, hp, mana): super().__init__(name, hp); self.mana = mana`",
            "super().__init__(name, hp) настраивает name и hp так же, как это делал бы обычный Hero.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\nclass Mage(Hero):\n    def __init__(self, name, hp, mana):\n        super().__init__(name, hp)\n        self.mana = mana\n\nm = Mage("Лея", 80, 50)\nprint(m.name)\nprint(m.mana)',
          xp: 30,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Особая атака мага",
          story: [
            "У `Hero` есть метод `attack(self)`, печатающий `Имя бьёт мечом!`. Создай `Mage(Hero)`, который переопределяет `attack`, печатая `Имя бросает огненный шар!`. Создай маг `Лея` и вызови `attack()`.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def attack(self):\n        print(f"{self.name} бьёт мечом!")\n\n# Mage(Hero) с переопределённым attack\n\nm = Mage("Лея", 80)\nm.attack()\n',
          check: { expectedOutput: "Лея бросает огненный шар!", codeContains: ["class Mage(Hero)", "def attack"] },
          hints: [
            "Mage не обязательно переопределять __init__ — если ему хватает того же набора параметров, что и Hero, свой __init__ не нужен.",
            'В Mage добавь свой def attack(self): print(f"{self.name} бросает огненный шар!") — он «перекроет» метод родителя.',
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def attack(self):\n        print(f"{self.name} бьёт мечом!")\n\nclass Mage(Hero):\n    def attack(self):\n        print(f"{self.name} бросает огненный шар!")\n\nm = Mage("Лея", 80)\nm.attack()',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что делает super().__init__(name, hp) внутри Mage?",
              options: [
                "Вызывает конструктор родительского класса Hero, чтобы настроить общие атрибуты",
                "Создаёт нового героя",
                "Удаляет атрибуты",
                "Ничего не делает",
              ],
              correctIndex: 0,
              explain: "super() — ссылка на родительский класс. super().__init__() запускает его конструктор.",
            },
            {
              question: "Что значит «переопределить метод»?",
              options: [
                "Написать в дочернем классе метод с тем же именем, заменяющий родительский",
                "Удалить метод родителя",
                "Скопировать метод в другой файл",
                "Переименовать метод",
              ],
              correctIndex: 0,
              explain: "Дочерний класс может дать методу своё поведение, сохранив то же имя — это override.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 6
    {
      id: "polimorfizm",
      emoji: "🎭",
      title: "Полиморфизм: одна команда, разное поведение",
      subtitle: "Работать с разными объектами одинаковым кодом",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Один вызов — разные результаты",
          text: [
            "Полиморфизм («много форм») означает: можно вызвать один и тот же метод (`attack()`) у разных объектов, и каждый выполнит СВОЮ версию — без единого `if type == ...` в коде, который его вызывает.",
            "Это удобно: если завтра появится новый вид героя, старый код (например, цикл боя) не придётся переписывать — он просто вызовет `attack()`, а нужное поведение выберется само.",
          ],
          code:
            'class Hero:\n    def __init__(self, name):\n        self.name = name\n    def attack(self):\n        print(f"{self.name} бьёт мечом!")\n\nclass Mage(Hero):\n    def attack(self):\n        print(f"{self.name} бросает огненный шар!")\n\nclass Healer(Hero):\n    def attack(self):\n        print(f"{self.name} лечит союзника!")\n\nparty = [Hero("Рекс"), Mage("Лея"), Healer("Соня")]\nfor member in party:\n    member.attack()',
          codeNote: "Цикл один, но три разные строчки вывода — каждый объект знает своё поведение.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Атака всего отряда",
          story: [
            "Есть `Hero` с методом `attack` (\"бьёт мечом!\"), `Mage(Hero)` с переопределённым `attack` (\"бросает огненный шар!\") и `Healer(Hero)` с переопределённым `attack` (\"лечит союзника!\"). Собери отряд `party` из героя `Рекс`, мага `Лея` и лекаря `Соня`, и одним циклом вызови `attack()` у каждого.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name):\n        self.name = name\n    def attack(self):\n        print(f"{self.name} бьёт мечом!")\n\nclass Mage(Hero):\n    def attack(self):\n        print(f"{self.name} бросает огненный шар!")\n\nclass Healer(Hero):\n    def attack(self):\n        print(f"{self.name} лечит союзника!")\n\n# собери party и вызови attack() у каждого циклом\n',
          check: {
            expectedOutput: "Рекс бьёт мечом!\nЛея бросает огненный шар!\nСоня лечит союзника!",
            codeContains: ["for"],
          },
          hints: [
            '`party = [Hero("Рекс"), Mage("Лея"), Healer("Соня")]`',
            "`for member in party: member.attack()`",
          ],
          solution:
            'class Hero:\n    def __init__(self, name):\n        self.name = name\n    def attack(self):\n        print(f"{self.name} бьёт мечом!")\n\nclass Mage(Hero):\n    def attack(self):\n        print(f"{self.name} бросает огненный шар!")\n\nclass Healer(Hero):\n    def attack(self):\n        print(f"{self.name} лечит союзника!")\n\nparty = [Hero("Рекс"), Mage("Лея"), Healer("Соня")]\nfor member in party:\n    member.attack()',
          xp: 30,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Проверка типа объекта",
          story: [
            "Иногда нужно узнать, какого именно типа объект. `isinstance(объект, Класс)` возвращает `True`/`False`. Проверь, является ли маг `Лея` экземпляром `Mage`, а затем — экземпляром `Hero` (маг ведь и герой одновременно, ведь наследуется от него!).",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name):\n        self.name = name\n\nclass Mage(Hero):\n    pass\n\nm = Mage("Лея")\n# проверь isinstance(m, Mage) и isinstance(m, Hero)\n',
          check: { expectedOutput: "True\nTrue", codeContains: ["isinstance"] },
          hints: [
            "`print(isinstance(m, Mage))` затем `print(isinstance(m, Hero))`.",
            "Объект дочернего класса — это ОДНОВРЕМЕННО и экземпляр родительского класса.",
          ],
          solution:
            'class Hero:\n    def __init__(self, name):\n        self.name = name\n\nclass Mage(Hero):\n    pass\n\nm = Mage("Лея")\nprint(isinstance(m, Mage))\nprint(isinstance(m, Hero))',
          xp: 20,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что даёт полиморфизм?",
              options: [
                "Можно вызывать один и тот же метод у разных объектов, и каждый выполнит своё поведение",
                "Все объекты становятся одинаковыми",
                "Код выполняется быстрее",
                "Атрибуты становятся приватными",
              ],
              correctIndex: 0,
              explain: "Именно так: единый интерфейс (одно имя метода), разное поведение внутри каждого класса.",
            },
            {
              question: "Что вернёт isinstance(mage_object, Hero), если Mage наследуется от Hero?",
              options: ["True — Mage является Hero через наследование", "False", "Ошибку", "None"],
              correctIndex: 0,
              explain: "Наследник — это одновременно и экземпляр родителя, поэтому isinstance возвращает True для обоих классов.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 7
    {
      id: "magicheskie-metody",
      emoji: "✨",
      title: "Магические методы: __str__, __eq__, __len__",
      subtitle: "Методы с двойным подчёркиванием управляют поведением встроенных функций",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "print(объект) можно настроить",
          text: [
            "По умолчанию `print(объект)` выводит малопонятную строку типа `<__main__.Hero object at 0x...>`. Метод `__str__(self)` позволяет задать, что именно должно печататься вместо этого.",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def __str__(self):\n        return f"{self.name} (HP: {self.hp})"\n\nh = Hero("Мила", 100)\nprint(h)',
          codeNote: "print(h) теперь вызывает __str__ автоматически и печатает Мила (HP: 100).",
        },
        {
          kind: "theory",
          id: "t2",
          title: "== можно определить по-своему",
          text: [
            "По умолчанию Python сравнивает объекты «по адресу в памяти» — два разных героя с одинаковым именем считаются НЕ равными. `__eq__(self, other)` позволяет задать своё правило сравнения — например, «равны, если совпадает имя».",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def __eq__(self, other):\n        return self.name == other.name\n\nh1 = Hero("Мила", 100)\nh2 = Hero("Мила", 50)\nprint(h1 == h2)',
          codeNote: "True — хотя здоровье разное, имена совпадают, а сравниваем мы именно по имени.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Красивая печать героя",
          story: [
            "Добавь классу `Hero` метод `__str__(self)`, возвращающий строку `Имя (HP: здоровье)`. Создай героя `Мила` со здоровьем `100` и просто напечатай его через `print(h)`.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    # добавь __str__\n\nh = Hero("Мила", 100)\nprint(h)\n',
          check: { expectedOutput: "Мила (HP: 100)", codeContains: ["__str__"] },
          hints: ['`def __str__(self): return f"{self.name} (HP: {self.hp})"`'],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def __str__(self):\n        return f"{self.name} (HP: {self.hp})"\n\nh = Hero("Мила", 100)\nprint(h)',
          xp: 25,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Сравнение героев по имени",
          story: [
            "Добавь классу `Hero` метод `__eq__(self, other)`, считающий героев равными, если у них одинаковое `name`. Создай `Мила` (HP 100) и `Мила` (HP 50), и напечатай результат их сравнения через `==`.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    # добавь __eq__\n\nh1 = Hero("Мила", 100)\nh2 = Hero("Мила", 50)\nprint(h1 == h2)\n',
          check: { expectedOutput: "True", codeContains: ["__eq__"] },
          hints: ["`def __eq__(self, other): return self.name == other.name`"],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    def __eq__(self, other):\n        return self.name == other.name\n\nh1 = Hero("Мила", 100)\nh2 = Hero("Мила", 50)\nprint(h1 == h2)',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Какой метод определяет, что напечатается при print(объект)?",
              options: ["__str__", "__print__", "__init__", "__show__"],
              correctIndex: 0,
              explain: "__str__ возвращает строку, которую print() покажет вместо стандартного технического представления.",
            },
            {
              question: "Что по умолчанию делает == для двух объектов без __eq__?",
              options: [
                "Сравнивает, один ли это и тот же объект в памяти",
                "Всегда возвращает True",
                "Сравнивает по имени класса",
                "Вызывает ошибку",
              ],
              correctIndex: 0,
              explain: "Без __eq__ Python сравнивает объекты «по адресу» — два разных объекта с одинаковыми данными будут не равны.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 8
    {
      id: "atributy-klassa-i-metody",
      emoji: "🏷️",
      title: "Атрибуты класса, classmethod и staticmethod",
      subtitle: "Не всё в классе принадлежит конкретному объекту",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Атрибут класса — общий для всех объектов",
          text: [
            "Если объявить переменную прямо в теле класса (без `self`, не в `__init__`), это атрибут КЛАССА — один общий для всех объектов, а не свой у каждого. Удобно, например, для счётчика: сколько всего героев создано.",
            "Обратиться к нему можно и через объект (`self.total_created`), и через сам класс (`Hero.total_created`) — но менять его стоит именно через класс, чтобы не создать случайно отдельный атрибут объекта с тем же именем.",
          ],
          code:
            'class Hero:\n    total_created = 0\n\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n        Hero.total_created += 1\n\nh1 = Hero("Мила", 100)\nh2 = Hero("Глеб", 90)\nprint(Hero.total_created)',
          codeNote: "total_created — общий счётчик, а не свойство конкретного героя. После создания двух героев он равен 2.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "classmethod и staticmethod",
          text: [
            "`@classmethod` — метод, который получает первым параметром не `self` (конкретный объект), а `cls` (сам класс). Удобно для «альтернативных конструкторов» — способов создать объект не совсем обычным способом.",
            "`@staticmethod` — метод, который вообще не получает ни `self`, ни `cls`. Это просто обычная функция, которую логично держать внутри класса, потому что она с ним тематически связана.",
          ],
          code:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    @classmethod\n    def from_string(cls, s):\n        name, hp = s.split(",")\n        return cls(name, int(hp))\n\n    @staticmethod\n    def is_valid_name(name):\n        return len(name) > 0 and name[0].isupper()\n\nh = Hero.from_string("Мила,100")\nprint(h.name)\nprint(Hero.is_valid_name("мила"))',
          codeNote: "from_string — способ создать героя из строки (например, из файла). is_valid_name вообще не трогает self — просто удобная функция «в контексте» класса.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Сколько героев мы создали?",
          story: [
            "Добавь классу `Hero` атрибут класса `total_created = 0` и увеличивай его на 1 внутри `__init__` при создании каждого героя (через `Hero.total_created += 1`). Создай трёх героев и напечатай `Hero.total_created`.",
          ],
          starterCode:
            "class Hero:\n    # добавь total_created как атрибут класса\n\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n        # увеличь Hero.total_created\n\n# создай трёх героев и напечатай Hero.total_created\n",
          check: { expectedOutput: "3", codeContains: ["total_created"] },
          hints: [
            "Атрибут класса объявляется прямо в теле класса, без self: `total_created = 0`, на уровне с `def __init__`.",
            "Внутри __init__: `Hero.total_created += 1` — через имя класса, а не через self.",
          ],
          solution:
            'class Hero:\n    total_created = 0\n\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n        Hero.total_created += 1\n\nh1 = Hero("Мила", 100)\nh2 = Hero("Глеб", 90)\nh3 = Hero("Рекс", 80)\nprint(Hero.total_created)',
          xp: 30,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Альтернативный конструктор из строки",
          story: [
            "Добавь классу `Hero` метод `@classmethod from_string(cls, s)`, который принимает строку вида `\"Мила,100\"`, разбивает её по запятой и создаёт героя. Создай героя через `Hero.from_string(\"Мила,100\")` и напечатай его имя, потом здоровье.",
          ],
          starterCode:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    # добавь classmethod from_string\n\nh = Hero.from_string("Мила,100")\nprint(h.name)\nprint(h.hp)\n',
          check: { expectedOutput: "Мила\n100", codeContains: ["@classmethod", "cls"] },
          hints: [
            "`@classmethod` пишется прямо перед методом, первый параметр — `cls` (класс), а не `self`.",
            '`name, hp = s.split(","); return cls(name, int(hp))` — не забудь превратить hp в число.',
          ],
          solution:
            'class Hero:\n    def __init__(self, name, hp):\n        self.name = name\n        self.hp = hp\n\n    @classmethod\n    def from_string(cls, s):\n        name, hp = s.split(",")\n        return cls(name, int(hp))\n\nh = Hero.from_string("Мила,100")\nprint(h.name)\nprint(h.hp)',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Чем атрибут класса отличается от атрибута объекта (self.x)?",
              options: [
                "Атрибут класса общий для ВСЕХ объектов, а self.x — своё значение у каждого объекта",
                "Атрибут класса нельзя изменить",
                "Разницы нет, это два названия одного и того же",
                "Атрибут класса работает только со строками",
              ],
              correctIndex: 0,
              explain: "Атрибут класса живёт «на уровне класса» и делится между всеми экземплярами — в отличие от self.x, своего у каждого объекта.",
            },
            {
              question: "Что получает classmethod первым параметром вместо self?",
              options: [
                "cls — сам класс, а не конкретный объект",
                "Ничего, у classmethod нет параметров",
                "Список всех созданных объектов",
                "Строку с именем метода",
              ],
              correctIndex: 0,
              explain: "cls позволяет внутри метода создавать новые объекты именно этого класса — например, через cls(...).",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 9
    {
      id: "sobstvennye-iskliucheniya",
      emoji: "🚨",
      title: "Собственные исключения",
      subtitle: "raise и класс ошибки, который сам придумываешь",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Своё исключение — это просто класс",
          text: [
            "`raise` поднимает («выбрасывает») ошибку прямо во время выполнения программы. Встроенные ошибки (`ValueError`, `TypeError`...) — это классы, унаследованные от `Exception`. Своя ошибка — точно такой же класс, только придуманный тобой.",
            "Перехватить её можно через `try` / `except ИмяОшибки as e` — точно так же, как встроенную. `e` хранит саму ошибку, а `print(e)` покажет сообщение, с которым её создали.",
          ],
          code:
            'class NotEnoughManaError(Exception):\n    pass\n\nclass Mage:\n    def __init__(self, name, mana):\n        self.name = name\n        self.mana = mana\n\n    def cast_spell(self, cost):\n        if cost > self.mana:\n            raise NotEnoughManaError(f"{self.name}: не хватает маны!")\n        self.mana -= cost\n\nm = Mage("Лея", 30)\ntry:\n    m.cast_spell(50)\nexcept NotEnoughManaError as e:\n    print(e)',
          codeNote: "class NotEnoughManaError(Exception): pass — вот и всё определение своей ошибки, дальше она ведёт себя как обычная.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Заклинание без маны",
          story: [
            "Определи `class NotEnoughManaError(Exception): pass`. У класса `Mage(name, mana)` метод `cast_spell(self, cost)`: если `cost > self.mana` — выбрасывает `NotEnoughManaError` с сообщением `\"Имя: не хватает маны!\"`, иначе уменьшает `self.mana` на `cost` и печатает `\"Имя использует заклинание за cost маны\"`.",
            "Создай мага `Лея` с маной `30`. Вызови `cast_spell(20)` (получится), затем в `try/except` вызови `cast_spell(50)` (не хватит) и напечатай пойманную ошибку. В конце напечатай остаток `mana`.",
          ],
          starterCode:
            "class NotEnoughManaError(Exception):\n    pass\n\nclass Mage:\n    def __init__(self, name, mana):\n        self.name = name\n        self.mana = mana\n\n    # добавь cast_spell\n\nm = Mage(\"Лея\", 30)\n# cast_spell(20), потом try/except cast_spell(50), потом print(m.mana)\n",
          check: {
            expectedOutput: "Лея использует заклинание за 20 маны\nЛея: не хватает маны!\n10",
            codeContains: ["raise NotEnoughManaError", "except NotEnoughManaError"],
          },
          hints: [
            'В cast_spell: `if cost > self.mana: raise NotEnoughManaError(f"{self.name}: не хватает маны!")`, иначе `self.mana -= cost` и print.',
            "`try:\\n    m.cast_spell(50)\\nexcept NotEnoughManaError as e:\\n    print(e)`",
          ],
          solution:
            'class NotEnoughManaError(Exception):\n    pass\n\nclass Mage:\n    def __init__(self, name, mana):\n        self.name = name\n        self.mana = mana\n\n    def cast_spell(self, cost):\n        if cost > self.mana:\n            raise NotEnoughManaError(f"{self.name}: не хватает маны!")\n        self.mana -= cost\n        print(f"{self.name} использует заклинание за {cost} маны")\n\nm = Mage("Лея", 30)\nm.cast_spell(20)\ntry:\n    m.cast_spell(50)\nexcept NotEnoughManaError as e:\n    print(e)\nprint(m.mana)',
          xp: 30,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Инвентарь с ограничением",
          story: [
            "Определи `class InventoryFullError(Exception): pass`. У класса `Inventory(capacity)` метод `add_item(self, item)`: если предметов уже `capacity` штук — выбрасывает `InventoryFullError(\"Инвентарь полон!\")`, иначе добавляет предмет.",
            "Создай инвентарь на `2` места, добавь `\"Меч\"` и `\"Щит\"` (получится), затем в `try/except` попробуй добавить `\"Зелье\"` (не влезет) — напечатай сначала `type(e).__name__`, потом сам текст ошибки `e`.",
          ],
          starterCode:
            'class InventoryFullError(Exception):\n    pass\n\nclass Inventory:\n    def __init__(self, capacity):\n        self.capacity = capacity\n        self.items = []\n\n    # добавь add_item\n\ninv = Inventory(2)\ninv.add_item("Меч")\ninv.add_item("Щит")\n# try/except add_item("Зелье") — напечатай type(e).__name__ и e\n',
          check: { expectedOutput: "InventoryFullError\nИнвентарь полон!", codeContains: ["raise InventoryFullError", "except InventoryFullError"] },
          hints: [
            "`if len(self.items) >= self.capacity: raise InventoryFullError(\"Инвентарь полон!\")`, иначе `self.items.append(item)`.",
            "`type(e).__name__` — имя класса ошибки как строка, без всякого импорта.",
          ],
          solution:
            'class InventoryFullError(Exception):\n    pass\n\nclass Inventory:\n    def __init__(self, capacity):\n        self.capacity = capacity\n        self.items = []\n\n    def add_item(self, item):\n        if len(self.items) >= self.capacity:\n            raise InventoryFullError("Инвентарь полон!")\n        self.items.append(item)\n\ninv = Inventory(2)\ninv.add_item("Меч")\ninv.add_item("Щит")\ntry:\n    inv.add_item("Зелье")\nexcept InventoryFullError as e:\n    print(type(e).__name__)\n    print(e)',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Как объявить своё исключение?",
              options: [
                "Создать класс, наследующийся от Exception (или его подкласса)",
                "Написать функцию с именем error",
                "Использовать только встроенные ValueError и TypeError",
                "Добавить декоратор @exception к обычному классу",
              ],
              correctIndex: 0,
              explain: "`class MyError(Exception): pass` — и всё, дальше MyError можно raise и except как любую другую ошибку.",
            },
            {
              question: "Что делает `except NotEnoughManaError as e`?",
              options: [
                "Перехватывает исключение именно этого типа и сохраняет его в переменную e",
                "Игнорирует все ошибки без разбора",
                "Создаёт новый экземпляр NotEnoughManaError",
                "Останавливает программу немедленно",
              ],
              correctIndex: 0,
              explain: "После перехвата e хранит саму ошибку — например, print(e) покажет сообщение, с которым её создали через raise.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 10
    {
      id: "abstraktnye-klassy",
      emoji: "📜",
      title: "Абстрактные классы: обязательный контракт",
      subtitle: "Гарантируем, что у каждого наследника метод точно есть",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "ABC — класс, который нельзя создать «просто так»",
          text: [
            "`from abc import ABC, abstractmethod`. Если класс наследуется от `ABC` и у него есть метод с `@abstractmethod`, это означает: «у КАЖДОГО наследника этот метод должен быть реализован — иначе он не имеет права существовать».",
            "Полиморфизм из прошлого урока работал и без этого — но `ABC` превращает договорённость («у каждого героя должен быть attack») из простого пожелания в правило, которое Python проверяет сам.",
          ],
          code:
            'from abc import ABC, abstractmethod\n\nclass Enemy(ABC):\n    def __init__(self, name):\n        self.name = name\n\n    @abstractmethod\n    def attack(self):\n        pass\n\nclass Dragon(Enemy):\n    def attack(self):\n        print(f"{self.name} дышит огнём!")\n\nclass Goblin(Enemy):\n    def attack(self):\n        print(f"{self.name} бьёт дубиной!")\n\nfor e in [Dragon("Смауг"), Goblin("Грок")]:\n    e.attack()',
          codeNote: "И Dragon, и Goblin ОБЯЗАНЫ реализовать attack — иначе Python не даст создать их объекты.",
        },
        {
          kind: "theory",
          id: "t2",
          title: "Абстрактный класс нельзя создать напрямую",
          text: [
            "Если попытаться создать объект самого `Enemy` (у которого `attack` так и остался нереализованным), Python выбросит `TypeError`. Это и есть смысл контракта: недоделанный класс не должен превращаться в рабочий объект.",
          ],
          code:
            'from abc import ABC, abstractmethod\n\nclass Enemy(ABC):\n    @abstractmethod\n    def attack(self):\n        pass\n\ntry:\n    e = Enemy()\nexcept TypeError as ex:\n    print(type(ex).__name__)',
          codeNote: "Печатает TypeError — Python не позволяет создать объект класса с нереализованным abstractmethod.",
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Контракт для врагов",
          story: [
            "Создай абстрактный класс `Enemy(ABC)` с абстрактным методом `attack(self)`. Создай `Dragon(Enemy)`, у которого `attack` печатает `\"Имя дышит огнём!\"`, и `Goblin(Enemy)`, у которого `attack` печатает `\"Имя бьёт дубиной!\"`. Собери список из дракона `Смауг` и гоблина `Грок`, и вызови `attack()` у каждого циклом.",
          ],
          starterCode:
            "from abc import ABC, abstractmethod\n\n# class Enemy(ABC) с abstractmethod attack\n\n# class Dragon(Enemy) и class Goblin(Enemy)\n\n# собери список и вызови attack() у каждого\n",
          check: {
            expectedOutput: "Смауг дышит огнём!\nГрок бьёт дубиной!",
            codeContains: ["ABC", "abstractmethod", "class Dragon(Enemy)", "class Goblin(Enemy)"],
          },
          hints: [
            "`class Enemy(ABC): def __init__(self, name): self.name = name` и отдельно `@abstractmethod def attack(self): pass`.",
            "У Dragon и Goblin — свой __init__ не нужен, если хватает того же, что у Enemy: достаточно переопределить только attack.",
          ],
          solution:
            'from abc import ABC, abstractmethod\n\nclass Enemy(ABC):\n    def __init__(self, name):\n        self.name = name\n\n    @abstractmethod\n    def attack(self):\n        pass\n\nclass Dragon(Enemy):\n    def attack(self):\n        print(f"{self.name} дышит огнём!")\n\nclass Goblin(Enemy):\n    def attack(self):\n        print(f"{self.name} бьёт дубиной!")\n\nenemies = [Dragon("Смауг"), Goblin("Грок")]\nfor e in enemies:\n    e.attack()',
          xp: 30,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "Голого врага не бывает",
          story: [
            "Тот же `Enemy(ABC)` с абстрактным `attack` — но без реализации в самом `Enemy`. Попробуй создать `Enemy()` напрямую внутри `try/except TypeError` и напечатай `type(ex).__name__`, доказав, что Python не даст этого сделать.",
          ],
          starterCode:
            "from abc import ABC, abstractmethod\n\nclass Enemy(ABC):\n    @abstractmethod\n    def attack(self):\n        pass\n\n# try: создать Enemy() / except TypeError: напечатать type(ex).__name__\n",
          check: { expectedOutput: "TypeError", codeContains: ["abstractmethod", "except TypeError"] },
          hints: ["`try:\\n    e = Enemy()\\nexcept TypeError as ex:\\n    print(type(ex).__name__)`"],
          solution:
            'from abc import ABC, abstractmethod\n\nclass Enemy(ABC):\n    @abstractmethod\n    def attack(self):\n        pass\n\ntry:\n    e = Enemy()\nexcept TypeError as ex:\n    print(type(ex).__name__)',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Проверь себя",
          xp: 10,
          questions: [
            {
              question: "Что произойдёт при попытке создать объект абстрактного класса с нереализованным abstractmethod?",
              options: [
                "Python вызовет TypeError",
                "Объект создастся, но без атрибутов",
                "Метод attack автоматически станет пустым",
                "Ничего особенного не произойдёт",
              ],
              correctIndex: 0,
              explain: "Это и есть смысл ABC — недоделанный класс не должен превращаться в рабочий объект.",
            },
            {
              question: "Зачем нужны абстрактные классы, если полиморфизм работает и без них?",
              options: [
                "Чтобы гарантировать: каждый наследник ОБЯЗАН реализовать нужный метод, а не просто «может»",
                "Чтобы ускорить выполнение кода",
                "Абстрактные классы работают только с числами",
                "Без них Python не умеет наследование",
              ],
              correctIndex: 0,
              explain: "ABC превращает договорённость об общем методе в правило, которое сам Python проверяет при создании объекта.",
            },
          ],
        },
      ],
    },
    // ────────────────────────────────────────────────────────── Урок 11
    {
      id: "final-proekt-inventar",
      emoji: "🎒",
      title: "Финальный проект: инвентарь героя",
      subtitle: "Собери систему из нескольких классов",
      blocks: [
        {
          kind: "theory",
          id: "t1",
          title: "Классы могут содержать другие объекты",
          text: [
            "Отряд собирается в поход — нужен инвентарь. Хороший ООП-дизайн: класс `Item` (предмет) описывает один предмет, а класс `Inventory` (инвентарь) хранит СПИСОК предметов и умеет с ним работать.",
            "Это называется композицией: объект `Inventory` не наследуется от `Item`, а просто ХРАНИТ объекты `Item` внутри себя (в атрибуте `self.items`).",
          ],
        },
        {
          kind: "py-task",
          id: "z1",
          title: "Инвентарь героя",
          story: [
            "Создай класс `Item` с `__init__(self, name, price)`. Создай класс `Inventory` с `__init__(self)`, создающим пустой список `self.items = []`, и методом `add_item(self, item)`, добавляющим предмет в этот список, и методом `total_value(self)`, возвращающим сумму цен всех предметов.",
            "Создай инвентарь, добавь `Item(\"Меч\", 150)`, `Item(\"Щит\", 80)` и `Item(\"Зелье\", 20)`. Напечатай `total_value()`, потом количество предметов через `len(inv.items)`.",
          ],
          starterCode:
            "# class Item и class Inventory\n\ninv = Inventory()\n# добавь три предмета\n\nprint(inv.total_value())\nprint(len(inv.items))\n",
          check: {
            expectedOutput: "250\n3",
            codeContains: ["class Item", "class Inventory", "def add_item", "def total_value"],
          },
          hints: [
            "Item хранит только name и price — это просто «карточка предмета».",
            "В total_value() пройди циклом по self.items и складывай item.price.",
          ],
          solution:
            'class Item:\n    def __init__(self, name, price):\n        self.name = name\n        self.price = price\n\nclass Inventory:\n    def __init__(self):\n        self.items = []\n\n    def add_item(self, item):\n        self.items.append(item)\n\n    def total_value(self):\n        total = 0\n        for item in self.items:\n            total = total + item.price\n        return total\n\ninv = Inventory()\ninv.add_item(Item("Меч", 150))\ninv.add_item(Item("Щит", 80))\ninv.add_item(Item("Зелье", 20))\nprint(inv.total_value())\nprint(len(inv.items))',
          xp: 35,
        },
        {
          kind: "py-task",
          id: "z2",
          title: "len(inventory) вместо len(inventory.items)",
          story: [
            "Добавь классу `Inventory` магический метод `__len__(self)`, возвращающий `len(self.items)` — тогда можно будет писать просто `len(inv)`, как для списка. Добавь два предмета и напечатай `len(inv)`.",
          ],
          starterCode:
            'class Item:\n    def __init__(self, name, price):\n        self.name = name\n        self.price = price\n\nclass Inventory:\n    def __init__(self):\n        self.items = []\n\n    def add_item(self, item):\n        self.items.append(item)\n\n    # добавь __len__\n\ninv = Inventory()\ninv.add_item(Item("Меч", 150))\ninv.add_item(Item("Щит", 80))\nprint(len(inv))\n',
          check: { expectedOutput: "2", codeContains: ["__len__"] },
          hints: ["`def __len__(self): return len(self.items)`"],
          solution:
            'class Item:\n    def __init__(self, name, price):\n        self.name = name\n        self.price = price\n\nclass Inventory:\n    def __init__(self):\n        self.items = []\n\n    def add_item(self, item):\n        self.items.append(item)\n\n    def __len__(self):\n        return len(self.items)\n\ninv = Inventory()\ninv.add_item(Item("Меч", 150))\ninv.add_item(Item("Щит", 80))\nprint(len(inv))',
          xp: 25,
        },
        {
          kind: "quiz",
          id: "q1",
          title: "Экзамен архитектора классов",
          xp: 15,
          questions: [
            {
              question: "Чем композиция («Inventory хранит Item») отличается от наследования («Mage — это Hero»)?",
              options: [
                "Композиция — это «содержит», наследование — это «является»",
                "Это два названия одного и того же",
                "Композиция работает только со строками",
                "Наследование быстрее композиции",
              ],
              correctIndex: 0,
              explain: "Inventory не Item, но хранит предметы внутри себя — классический пример композиции.",
            },
            {
              question: "Что позволяет сделать __len__?",
              options: [
                "Использовать встроенную функцию len() прямо с объектом класса",
                "Ограничить количество атрибутов",
                "Удалить объект",
                "Посчитать методы класса",
              ],
              correctIndex: 0,
              explain: "Магические методы связывают встроенные функции Python (len, str, ==) с поведением твоего класса.",
            },
            {
              question: "Какие три идеи ООП мы прошли в этом треке?",
              options: [
                "Инкапсуляция, наследование, полиморфизм",
                "Циклы, условия, функции",
                "CSV, JSON, XML",
                "SELECT, WHERE, JOIN",
              ],
              correctIndex: 0,
              explain: "Три столпа ООП: инкапсуляция (прячем детали), наследование (расширяем), полиморфизм (единый интерфейс, разное поведение). Поздравляем с прохождением трека! 🛡️",
            },
          ],
        },
      ],
    },
  ],
};
