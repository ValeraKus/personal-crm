// Generator of fictional contacts for local testing.
// The content is Russian because it is what the user sees in the UI.
// Same seed -> same people, so test data is reproducible.

import type { NewContact, NewNote } from "../src/db/schema";

type Gender = "male" | "female";

export type SeedPerson = {
  contact: NewContact;
  notes: Omit<NewNote, "contactId">[];
};

// Small deterministic PRNG (mulberry32)
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability: number) => next() < probability,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
}

type Random = ReturnType<typeof createRandom>;

const MALE_FIRST_NAMES = [
  "Александр", "Алексей", "Андрей", "Антон", "Арсений", "Артём", "Борис", "Вадим", "Валерий",
  "Василий", "Виктор", "Виталий", "Владимир", "Владислав", "Георгий", "Глеб", "Григорий",
  "Даниил", "Денис", "Дмитрий", "Евгений", "Егор", "Иван", "Игорь", "Илья", "Кирилл",
  "Константин", "Лев", "Леонид", "Максим", "Марк", "Матвей", "Михаил", "Никита", "Николай",
  "Олег", "Павел", "Пётр", "Роман", "Руслан", "Семён", "Сергей", "Станислав", "Степан",
  "Тимофей", "Тимур", "Фёдор", "Эдуард", "Юрий", "Ярослав",
] as const;

const FEMALE_FIRST_NAMES = [
  "Александра", "Алёна", "Алина", "Алиса", "Анастасия", "Ангелина", "Анна", "Валентина",
  "Валерия", "Варвара", "Вера", "Вероника", "Виктория", "Галина", "Дарья", "Диана", "Ева",
  "Евгения", "Екатерина", "Елена", "Елизавета", "Жанна", "Зоя", "Ирина", "Карина", "Кира",
  "Ксения", "Лариса", "Лидия", "Любовь", "Людмила", "Маргарита", "Марина", "Мария", "Милана",
  "Надежда", "Наталья", "Нина", "Оксана", "Ольга", "Полина", "Светлана", "София", "Таисия",
  "Тамара", "Татьяна", "Ульяна", "Эльвира", "Юлия", "Яна",
] as const;

// Male forms; female forms are derived in feminineSurname()
const SURNAMES = [
  "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов",
  "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров",
  "Павлов", "Козлов", "Степанов", "Николаев", "Орлов", "Андреев", "Макаров", "Никитин",
  "Захаров", "Зайцев", "Соловьёв", "Борисов", "Яковлев", "Григорьев", "Романов", "Воробьёв",
  "Сергеев", "Кузьмин", "Фролов", "Александров", "Дмитриев", "Королёв", "Гусев", "Киселёв",
  "Ильин", "Максимов", "Поляков", "Сорокин", "Виноградов", "Ковалёв", "Белов", "Медведев",
  "Антонов", "Тарасов", "Жуков", "Баранов", "Филиппов", "Комаров", "Давыдов", "Беляев",
  "Герасимов", "Богданов", "Осипов", "Сидоров", "Матвеев", "Титов", "Марков", "Миронов",
  "Крылов", "Куликов", "Карпов", "Власов", "Мельников", "Денисов", "Гаврилов", "Тихонов",
  "Казаков", "Афанасьев", "Данилов", "Савельев", "Тимофеев", "Фомин", "Чернов", "Абрамов",
  "Мартынов", "Ефимов", "Федотов", "Щербаков", "Назаров", "Калинин", "Исаев", "Чернышёв",
  "Быков", "Маслов", "Родионов", "Коновалов", "Лазарев", "Воронин", "Климов", "Филатов",
  "Пономарёв", "Голубев", "Кудрявцев", "Прохоров", "Наумов", "Потапов", "Журавлёв",
  "Овчинников", "Трофимов", "Леонов", "Соболев", "Ермаков", "Колесников", "Гончаров",
  "Емельянов", "Никифоров", "Грачёв", "Котов", "Гришин", "Ефремов", "Архипов", "Громов",
  "Кириллов", "Малышев", "Панов", "Моисеев", "Румянцев", "Акимов", "Кондратьев", "Бирюков",
  "Горбунов", "Галкин", "Лукьянов", "Михеев", "Скворцов", "Юдин", "Белоусов", "Нестеров",
  "Симонов", "Харитонов", "Князев", "Цветков", "Левин", "Воронцов", "Рябов", "Ершов", "Мухин",
  "Бондаренко", "Шевченко", "Ткаченко", "Ким", "Цой", "Черных", "Седых", "Долгих",
  "Островский", "Вишневский", "Покровский", "Раевский", "Высоцкий", "Шапошников", "Толстой",
  "Трубецкой",
] as const;

function feminineSurname(surname: string) {
  if (/(ов|ев|ёв|ин|ын)$/.test(surname)) return `${surname}а`;
  if (/ский$/.test(surname)) return surname.replace(/ский$/, "ская");
  if (/цкий$/.test(surname)) return surname.replace(/цкий$/, "цкая");
  if (/ской$/.test(surname)) return surname.replace(/ской$/, "ская");
  if (/цкой$/.test(surname)) return surname.replace(/цкой$/, "цкая");
  if (/ой$/.test(surname)) return surname.replace(/ой$/, "ая");
  return surname;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(text: string) {
  return [...text.toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("");
}

// Picks "male|female" variant from "{он|она}" markers
function byGender(text: string, gender: Gender) {
  return text.replace(/\{([^|}]*)\|([^}]*)\}/g, (_, male: string, female: string) =>
    gender === "male" ? male : female,
  );
}

function yearsWord(age: number) {
  const lastTwo = age % 100;
  const last = age % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "лет";
  if (last === 1) return "год";
  if (last >= 2 && last <= 4) return "года";
  return "лет";
}

// Each workplace with roles that make sense there
const WORKPLACES: { place: string; roles: string[] }[] = [
  { place: "в студии «Пиксель»", roles: ["Дизайнер", "Арт-директор", "Иллюстратор", "Фронтенд-разработчик"] },
  { place: "в банке «Северный»", roles: ["Финансовый аналитик", "Юрист", "Бэкенд-разработчик", "HR-менеджер"] },
  { place: "в рекламном агентстве «Смысл»", roles: ["Копирайтер", "Маркетолог", "SMM-менеджер", "Аккаунт-менеджер"] },
  { place: "в стартапе про доставку еды", roles: ["Продакт-менеджер", "Технический директор", "Аналитик данных"] },
  { place: "в школе № 57", roles: ["Учитель математики", "Учитель литературы", "Школьный психолог"] },
  { place: "в городской больнице № 3", roles: ["Врач-терапевт", "Хирург", "Кардиолог", "Педиатр"] },
  { place: "в архитектурном бюро «Линия»", roles: ["Архитектор", "Дизайнер интерьеров", "Инженер-конструктор"] },
  { place: "на заводе «Электросила»", roles: ["Инженер-конструктор", "Главный технолог", "Начальник цеха"] },
  { place: "в IT-компании «Квант»", roles: ["Бэкенд-разработчик", "Тестировщик", "Девопс-инженер", "Тимлид", "Продакт-менеджер"] },
  { place: "в кофейне «Зерно»", roles: ["Бариста", "Обжарщик кофе"] },
  { place: "в издательстве «Полка»", roles: ["Редактор", "Корректор", "Переводчик"] },
  { place: "в продюсерском центре «Звук»", roles: ["Звукорежиссёр", "Продюсер", "Event-менеджер"] },
  { place: "в университете", roles: ["Преподаватель", "Доцент кафедры физики", "Научный сотрудник"] },
  { place: "в логистической компании «ТрансЛайн»", roles: ["Логист", "Руководитель склада", "Бухгалтер"] },
  { place: "в юридической фирме «Право и дело»", roles: ["Юрист", "Адвокат", "Нотариус"] },
  { place: "в клинике «Здоровье»", roles: ["Стоматолог", "Психолог", "Врач-терапевт"] },
  { place: "в онлайн-школе «Учи»", roles: ["Методист", "Преподаватель английского", "Маркетолог"] },
  { place: "в турагентстве «Глобус»", roles: ["Турменеджер", "Гид", "Директор"] },
  { place: "в строительной компании «Опора»", roles: ["Прораб", "Сметчик", "Инженер"] },
  { place: "в мебельной мастерской «Дуб»", roles: ["Столяр", "Дизайнер мебели"] },
  { place: "в ветклинике «Лапа»", roles: ["Ветеринар", "Ветеринарный хирург"] },
  { place: "в фитнес-клубе «Пульс»", roles: ["Тренер по йоге", "Фитнес-тренер", "Тренер по плаванию"] },
  { place: "в ресторане «Печь»", roles: ["Шеф-повар", "Сомелье", "Су-шеф"] },
  { place: "в агентстве недвижимости «Ключ»", roles: ["Риелтор", "Ипотечный брокер"] },
];

function job(random: Random) {
  const workplace = random.pick(WORKPLACES);
  return { role: random.pick(workplace.roles), place: workplace.place };
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

const RELATIONS = [
  "{Бывший коллега|Бывшая коллега}", "{Однокурсник|Однокурсница}",
  "{Одноклассник|Одноклассница}", "{Сосед|Соседка} по дому", "{Сосед|Соседка} по даче",
  "{Друг|Подруга} детства", "{Знакомый|Знакомая} по пробежкам", "Партнёр по теннису",
  "{Знакомый|Знакомая} по курсам английского", "Наш семейный врач", "Мой ментор",
  "{Друг|Подруга} семьи", "Родитель одноклассника сына", "{Бывший начальник|Бывшая начальница}",
  "{Знакомый|Знакомая} из бегового клуба", "Мастер по ремонту, делал{|а} нам кухню",
] as const;

const UNIVERSITIES = ["МГУ", "СПбГУ", "МФТИ", "Бауманке", "ВШЭ", "МИФИ", "РАНХиГС", "УрФУ"];
const CONFERENCES = ["Highload++", "TechLead Conf", "РИФ", "Белые ночи", "DUMP", "Product Camp"];
const COURSES = ["английского", "гончарного мастерства", "программирования", "вождения", "фотографии"];
const TRIPS = ["Алтай", "Эльбрус", "Байкал", "Кольский полуостров", "Камчатку", "Хибины"];
const CITIES = ["Казань", "Сочи", "Екатеринбург", "Новосибирск", "Калининград", "Тбилиси", "Ереван", "Нижний Новгород"];
const MUTUALS = ["общий друг Дима", "коллега Марина", "двоюродный брат", "однокурсница Катя", "сосед Артём", "сестра"];

const HOW_WE_MET: Array<(r: Random) => string> = [
  (r: Random) => `Учились вместе в ${r.pick(UNIVERSITIES)}`,
  (r: Random) => `Работали вместе ${job(r).place} в ${r.int(2010, 2024)} году`,
  (r: Random) => `Познакомились на конференции ${r.pick(CONFERENCES)} в ${r.int(2015, 2025)} году`,
  (r: Random) => `Познакомил ${r.pick(MUTUALS)}`,
  (r: Random) => `Соседи по подъезду с ${r.int(2012, 2024)} года`,
  (r: Random) => `Вместе ходили на курсы ${r.pick(COURSES)}`,
  (r: Random) => `Познакомились в походе на ${r.pick(TRIPS)}`,
  () => "Через чат дома, помогали друг другу с ремонтом",
  () => "Через чат родителей класса",
  (r: Random) => `Сидели рядом в самолёте Москва — ${r.pick(CITIES)}, разговорились`,
  () => "Познакомились на свадьбе у общих друзей",
  () => "Играем вместе в футбол по субботам",
  () => "{Его|Её} посоветовали знакомые",
  (r: Random) => `Познакомились в отпуске в ${r.pick(["Грузии", "Турции", "Армении", "Абхазии", "Дагестане"])}`,
  () => "Ходим в один спортзал",
];

const TOPICS = [
  "ремонта квартиры", "поиска работы", "запуска своего проекта", "выбора школы для ребёнка",
  "инвестиций", "отпуска в Грузии", "покупки машины", "смены профессии", "переезда",
  "свадьбы", "покупки дачи", "курсов по аналитике", "собеседования в новую компанию",
] as const;

const AGREEMENTS = [
  "созвонимся через две недели", "я пришлю резюме знакомого", "встретимся после праздников",
  "{он|она} пришлёт презентацию до пятницы", "я узнаю контакты хорошего юриста",
  "в следующий раз обедаем за мой счёт", "{он|она} познакомит с нужным человеком",
  "я скину ссылки на полезные курсы", "вернёмся к вопросу в следующем месяце",
  "увидимся на дне рождения у Саши",
] as const;

const MONTHS_IN = [
  "январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре",
  "октябре", "ноябре", "декабре",
] as const;

const BOOKS = ["Мастер и Маргарита", "Сапиенс", "Чистый код", "Атлант расправил плечи", "Думай медленно… решай быстро"];
const HOBBIES = ["горные лыжи", "настолки", "джаз", "велосипед", "рыбалку", "кино Тарковского", "пробежки", "фотографию"];
const GIFTS = ["хороший чай", "книга", "билеты на концерт", "сертификат в книжный", "настольная игра"];
const KIDS_MALE = ["Миша", "Ваня", "Петя", "Саша", "Тимур", "Лёва"];
const KIDS_FEMALE = ["Аня", "Маша", "Соня", "Лиза", "Вера", "Даша"];
const FAVORS = ["переездом", "налоговым вычетом", "выбором ноутбука", "резюме", "поиском няни", "ремонтом машины"];

const NOTE_TEMPLATES: Array<(r: Random) => string> = [
  (r: Random) =>
    `Созвонились. Обсудили всё насчёт ${r.pick(TOPICS)}. Договорились: ${r.pick(AGREEMENTS)}.`,
  (r: Random) =>
    `Встретились на кофе. {Рассказал|Рассказала} про новую работу ${job(r).place}. Договорились увидеться снова в ${r.pick(MONTHS_IN)}.`,
  (r: Random) =>
    `День рождения — ${r.int(1, 28)} ${r.pick(["января", "марта", "мая", "июля", "сентября", "ноября"])}. Любит ${r.pick(HOBBIES)}, на подарок подойдёт ${r.pick(GIFTS)}.`,
  (r: Random) => `Договорились созвониться в ${r.pick(MONTHS_IN)} насчёт ${r.pick(TOPICS)}.`,
  (r: Random) =>
    `{Попросил|Попросила} совета по поводу ${r.pick(TOPICS)}. Я скину ссылки и контакты знакомых.`,
  (r: Random) => `{Переехал|Переехала} в ${r.pick(CITIES)}. Новый адрес пока не знаю.`,
  (r: Random) => `{Должен|Должна} вернуть книгу «${r.pick(BOOKS)}».`,
  (r: Random) => {
    const age = r.int(1, 16);
    return r.chance(0.5)
      ? `Есть сын ${r.pick(KIDS_MALE)}, ${age} ${yearsWord(age)}.`
      : `Есть дочь ${r.pick(KIDS_FEMALE)}, ${age} ${yearsWord(age)}.`;
  },
  () => "Не пьёт кофе, только чай. В следующий раз встречаемся в чайной.",
  (r: Random) =>
    `Ищет человека на позицию «${lowerFirst(job(r).role)}» в команду — можно порекомендовать кого-то из знакомых.`,
  () => "{Звонил|Звонила} просто узнать, как дела. Надо перезвонить, когда будет время.",
  (r: Random) => `{Помог|Помогла} с ${r.pick(FAVORS)} — надо отблагодарить.`,
  (r: Random) =>
    `{Обещал|Обещала} познакомить с ${r.pick(["хорошим стоматологом", "толковым юристом", "своим бывшим руководителем", "риелтором", "автомехаником"])}.`,
  (r: Random) =>
    `Договорились вместе сходить на ${r.pick(["концерт", "выставку", "футбол", "стендап", "спектакль"])} в ${r.pick(MONTHS_IN)}.`,
  (r: Random) =>
    `Пересеклись на ${r.pick(["дне рождения у Саши", "конференции", "свадьбе у друзей", "пробежке в парке"])}. Коротко поговорили, обещали созвониться.`,
  () => "Напомнить через месяц про обещанные контакты.",
  (r: Random) => {
    const { role, place } = job(r);
    return `Сменил{|а} работу, теперь ${lowerFirst(role)} ${place}. Говорит, что очень {доволен|довольна}.`;
  },
];

function personName(random: Random, gender: Gender) {
  const firstName =
    gender === "male" ? random.pick(MALE_FIRST_NAMES) : random.pick(FEMALE_FIRST_NAMES);
  const surname = random.pick(SURNAMES);
  return {
    firstName,
    lastName: gender === "male" ? surname : feminineSurname(surname),
  };
}

function about(random: Random, gender: Gender) {
  const roll = random.next();
  const { role, place } = job(random);
  if (roll < 0.5) return `${role} ${place}`;
  if (roll < 0.7) return byGender(random.pick(RELATIONS), gender);
  if (roll < 0.9) {
    return `${byGender(random.pick(RELATIONS), gender)}, сейчас ${lowerFirst(role)} ${place}`;
  }
  return null;
}

// Several different notes: the same template never repeats for one person
function pickDistinct<T>(random: Random, items: readonly T[], count: number) {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index--) {
    const swapWith = random.int(0, index);
    [pool[index], pool[swapWith]] = [pool[swapWith], pool[index]];
  }
  return pool.slice(0, count);
}

function phone(random: Random) {
  const digits = (count: number) =>
    Array.from({ length: count }, () => random.int(0, 9)).join("");
  if (random.chance(0.06)) return `+7 495 ${digits(3)}-${digits(2)}-${digits(2)}`;
  return `+7 9${digits(2)} ${digits(3)}-${digits(2)}-${digits(2)}`;
}

// Reserved example.* domains: these addresses can never reach a real person
const EMAIL_DOMAINS = ["example.com", "example.org", "example.net"] as const;

function email(random: Random, firstName: string, lastName: string, usedEmails: Set<string>) {
  const first = transliterate(firstName);
  const last = transliterate(lastName);
  const local = random.pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${random.int(70, 99)}`,
    `${last}${random.int(1, 999)}`,
  ]);
  const domain = random.pick(EMAIL_DOMAINS);
  let address = `${local}@${domain}`;
  for (let suffix = 2; usedEmails.has(address); suffix++) {
    address = `${local}${suffix}@${domain}`;
  }
  usedEmails.add(address);
  return address;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function randomDateBetween(random: Random, from: Date, to: Date) {
  const time = from.getTime() + random.next() * (to.getTime() - from.getTime());
  // Notes are written during the day, not at 4 a.m.
  const date = new Date(time);
  date.setHours(random.int(9, 22), random.int(0, 59), random.int(0, 59), 0);
  return date.getTime() > to.getTime() ? new Date(to) : date;
}

export function generatePeople(count: number, now: Date, seed = 20261007): SeedPerson[] {
  const random = createRandom(seed);
  const usedEmails = new Set<string>();
  const earliest = new Date(now.getTime() - 4 * 365 * DAY_MS);

  return Array.from({ length: count }, () => {
    const gender: Gender = random.chance(0.5) ? "male" : "female";
    const { firstName, lastName } = personName(random, gender);
    const createdAt = randomDateBetween(random, earliest, new Date(now.getTime() - DAY_MS));

    const noteCount = random.chance(0.25) ? 0 : random.int(1, 6);
    const notes = pickDistinct(random, NOTE_TEMPLATES, noteCount)
      .map((template) => ({
        body: byGender(template(random), gender),
        createdAt: randomDateBetween(random, createdAt, now),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const contact: NewContact = {
      name: `${firstName} ${lastName}`,
      about: about(random, gender),
      howWeMet: random.chance(0.85) ? byGender(random.pick(HOW_WE_MET)(random), gender) : null,
      phone: random.chance(0.9) ? phone(random) : null,
      email: random.chance(0.75) ? email(random, firstName, lastName, usedEmails) : null,
      createdAt,
      updatedAt: createdAt,
    };

    return { contact, notes };
  });
}
