//! Реестр «предметных паков» (Subject Packs).
//!
//! Пак — это конфиг В КОДЕ (не в БД на старте), описывающий всё предметно-специфичное:
//! трактовку уровня курса, разрешённые типы упражнений, персону генератора и голос(а)
//! озвучки. Цель фазы 1 — ввести абстракцию обратносовместимо: пак `language-fr`
//! обязан 1:1 повторять текущее поведение французского, поэтому неизвестные/пустые
//! комбинации subject+language резолвятся в него же.
//!
//! См. `subject-packs-spec.md`.
//!
//! Часть API реестра (персона генератора, ролевые голоса, не-CEFR схемы уровней,
//! маппинг встроенных курсов) подключается в следующих слайсах фазы 1 (DTO → handlers),
//! поэтому пока помечено `allow(dead_code)`, чтобы не плодить предупреждения.
#![allow(dead_code)]

/// Как трактовать `course.level`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LevelScheme {
    /// Языки: A1…C2 (текущее поведение французского).
    Cefr,
    /// Класс французской школы (см. FRENCH_GRADES) — математика/физика/история.
    Grade,
    /// Уровень из освоенности пререквизитов — для STEM позже.
    ConceptGraph,
}

/// Шкала классов французской школы (решение июля-2026: школьные предметы —
/// по французской программе, контент на французском). Порядок — от младших к старшим.
pub const FRENCH_GRADES: &[&str] = &["6e", "5e", "4e", "3e", "2nde", "1re", "Terminale"];

/// Голос(а) Inworld для пака. Голос выбирается ПО ПАКУ (= по языку курса),
/// а не один на всё приложение, иначе французский голос читал бы английский текст.
#[derive(Debug, Clone, Copy)]
pub struct TtsVoice {
    /// Имя голоса Inworld по умолчанию (для языков — нативного).
    pub default: &'static str,
    /// Опциональные ролевые голоса (coach/example/dialogue). `None` → везде `default`.
    pub roles: Option<&'static [(&'static str, &'static str)]>,
}

/// Описание предметного пака.
#[derive(Debug, Clone, Copy)]
pub struct SubjectPack {
    /// Идентификатор пака: `language-fr`, `language-en`, … (для STEM позже `math` и т.п.).
    pub id: &'static str,
    /// Человекочитаемое имя.
    pub display_name: &'static str,
    /// Как трактовать `course.level`.
    pub level_scheme: LevelScheme,
    /// Типы упражнений, которые рендерер/редактор умеют сохранять и показывать.
    pub allowed_types: &'static [&'static str],
    /// Персона генератора (подставляется в системный промпт генерации юнита).
    pub generation_persona: &'static str,
    /// Голос(а) озвучки.
    pub tts_voice: TtsVoice,
}

/// Типы упражнений языковых паков: legacy-список из `handlers/courses.rs`
/// + `dictation` (диктант, слайс 10 плана июля-2026).
///
/// ПРИМЕЧАНИЕ: `error-hunt` сознательно НЕ включён — он отсутствовал в исходном
/// серверном списке (хотя рендерер и генератор вариантов его поддерживают).
/// Включение `error-hunt` в allowed_types — отдельный follow-up.
const LANGUAGE_EXERCISE_TYPES: &[&str] = &[
    "theory", "grammar-quiz", "sentence-builder", "gender-quiz",
    "dialogue", "fill-blank", "number-quiz", "listening", "video",
    "dictation",
];

/// `language-fr` — эталон обратной совместимости. ДОЛЖЕН повторять текущее поведение
/// французского: тот же набор типов, та же персона генератора, тот же голос (`Alain`).
pub static LANGUAGE_FR: SubjectPack = SubjectPack {
    id: "language-fr",
    display_name: "Français",
    level_scheme: LevelScheme::Cefr,
    allowed_types: LANGUAGE_EXERCISE_TYPES,
    generation_persona: "методист образовательной платформы Memora",
    tts_voice: TtsVoice { default: "Alain", roles: None },
};

/// `language-en` — пилот мультипредметности. Максимум переиспользования FR:
/// те же типы упражнений и стратегии проверки, отличается персона и голос (`Clive`).
pub static LANGUAGE_EN: SubjectPack = SubjectPack {
    id: "language-en",
    display_name: "English",
    level_scheme: LevelScheme::Cefr,
    allowed_types: LANGUAGE_EXERCISE_TYPES,
    generation_persona: "методист по английскому языку образовательной платформы Memora",
    tts_voice: TtsVoice { default: "Clive", roles: None },
};

/// `language-de` — фаза 2. Голос `Josef` — тот же дефолт, что у озвучки карточек (audio.rs).
pub static LANGUAGE_DE: SubjectPack = SubjectPack {
    id: "language-de",
    display_name: "Deutsch",
    level_scheme: LevelScheme::Cefr,
    allowed_types: LANGUAGE_EXERCISE_TYPES,
    generation_persona: "методист по немецкому языку образовательной платформы Memora",
    tts_voice: TtsVoice { default: "Josef", roles: None },
};

/// `language-es` — фаза 2. Голос `Carmen` — тот же дефолт, что у озвучки карточек (audio.rs).
pub static LANGUAGE_ES: SubjectPack = SubjectPack {
    id: "language-es",
    display_name: "Español",
    level_scheme: LevelScheme::Cefr,
    allowed_types: LANGUAGE_EXERCISE_TYPES,
    generation_persona: "методист по испанскому языку образовательной платформы Memora",
    tts_voice: TtsVoice { default: "Carmen", roles: None },
};

// ---------- Школьные предметы (фаза 3): французская программа, контент на французском ----------

/// Математика/физика: теория, MCQ (рендерер grammar-quiz), числовые задачи,
/// упорядочивание, символьные выражения (CAS-проверка через memora-math).
/// `numeric` проверяется детерминированно на клиенте — LLM в пути проверки нет.
const MATH_EXERCISE_TYPES: &[&str] = &["theory", "grammar-quiz", "numeric", "ordering", "symbolic"];

/// История: MCQ, хронология (ordering), пропуски дат/терминов (fill-blank).
const HISTORY_EXERCISE_TYPES: &[&str] = &["theory", "grammar-quiz", "ordering", "fill-blank"];

/// Голос STEM-паков — французский (Alain): контент на языке школьной программы.
pub static MATH_FR: SubjectPack = SubjectPack {
    id: "math",
    display_name: "Mathématiques",
    level_scheme: LevelScheme::Grade,
    allowed_types: MATH_EXERCISE_TYPES,
    generation_persona: "опытный преподаватель математики французской школы (programme scolaire français)",
    tts_voice: TtsVoice { default: "Alain", roles: None },
};

pub static PHYSICS_FR: SubjectPack = SubjectPack {
    id: "physics",
    display_name: "Physique-chimie",
    level_scheme: LevelScheme::Grade,
    allowed_types: MATH_EXERCISE_TYPES,
    generation_persona: "опытный преподаватель физики и химии французской школы (programme scolaire français)",
    tts_voice: TtsVoice { default: "Alain", roles: None },
};

pub static HISTORY_FR: SubjectPack = SubjectPack {
    id: "history",
    display_name: "Histoire",
    level_scheme: LevelScheme::Grade,
    allowed_types: HISTORY_EXERCISE_TYPES,
    generation_persona: "опытный преподаватель истории французской школы (programme scolaire français)",
    tts_voice: TtsVoice { default: "Alain", roles: None },
};

/// Подбор пака по домену и языку курса.
///
/// `subject` — домен (`language`/`math`/…). Для языков конкретный язык задаётся `language`
/// (`fr`/`en`/…), pack-id собирается как `language-{language}`.
///
/// Обратная совместимость: любая неизвестная/пустая комбинация резолвится в `language-fr`,
/// чтобы существующие курсы (где `subject` по умолчанию `'language'`, а `language` обычно `fr`)
/// вели себя как раньше.
pub fn pack_for(subject: &str, language: Option<&str>) -> &'static SubjectPack {
    match subject {
        "language" | "" => match language {
            Some("en") => &LANGUAGE_EN,
            Some("de") => &LANGUAGE_DE,
            Some("es") => &LANGUAGE_ES,
            Some("fr") | None => &LANGUAGE_FR,
            // Неизвестные языки — безопасный фолбэк на FR.
            _ => &LANGUAGE_FR,
        },
        "math" => &MATH_FR,
        "physics" | "physique" | "physique-chimie" => &PHYSICS_FR,
        "history" | "histoire" => &HISTORY_FR,
        // Неизвестный домен — безопасный фолбэк на FR.
        _ => &LANGUAGE_FR,
    }
}

/// Нормализует подсказку языка к коду пака: понимает коды (`fr`/`en`/…) и
/// человекочитаемые названия, которыми фронтенд/промпты описывают язык
/// («французский», "english", "anglais"). Неизвестное → `None` (фолбэк FR в `pack_for`).
pub fn normalize_language(hint: &str) -> Option<&'static str> {
    match hint.trim().to_lowercase().as_str() {
        "fr" | "французский" | "french" | "français" | "francais" => Some("fr"),
        "en" | "английский" | "english" | "anglais" => Some("en"),
        "de" | "немецкий" | "german" | "deutsch" | "allemand" => Some("de"),
        "es" | "испанский" | "spanish" | "español" | "espanol" | "espagnol" => Some("es"),
        "ru" | "русский" | "russian" | "russe" => Some("ru"),
        _ => None,
    }
}

/// Подбор пака для встроенного курса по его строковому id.
/// Встроенные курсы (`edito-a1` и т.п.) не лежат в `custom_courses`, поэтому мапятся по id.
pub fn pack_for_course_id(course_id: &str) -> &'static SubjectPack {
    match course_id {
        "edito-a1" | "edito-a2" => &LANGUAGE_FR,
        _ => &LANGUAGE_FR,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fr_pack_resolves_for_language_fr() {
        let p = pack_for("language", Some("fr"));
        assert_eq!(p.id, "language-fr");
        assert_eq!(p.tts_voice.default, "Alain");
        assert_eq!(p.level_scheme, LevelScheme::Cefr);
    }

    #[test]
    fn en_pack_resolves_for_language_en() {
        let p = pack_for("language", Some("en"));
        assert_eq!(p.id, "language-en");
        assert_eq!(p.tts_voice.default, "Clive");
    }

    #[test]
    fn de_es_packs_resolve() {
        assert_eq!(pack_for("language", Some("de")).id, "language-de");
        assert_eq!(pack_for("language", Some("de")).tts_voice.default, "Josef");
        assert_eq!(pack_for("language", Some("es")).id, "language-es");
        assert_eq!(pack_for("language", Some("es")).tts_voice.default, "Carmen");
    }

    #[test]
    fn school_subject_packs_resolve() {
        let math = pack_for("math", None);
        assert_eq!(math.id, "math");
        assert_eq!(math.level_scheme, LevelScheme::Grade);
        assert!(math.allowed_types.contains(&"numeric"));
        assert!(math.allowed_types.contains(&"ordering"));
        assert!(!math.allowed_types.contains(&"fill-blank"));

        assert_eq!(pack_for("physics", Some("fr")).id, "physics");
        assert_eq!(pack_for("physique-chimie", None).id, "physics");

        let history = pack_for("history", None);
        assert_eq!(history.id, "history");
        assert!(history.allowed_types.contains(&"ordering"));
        assert!(history.allowed_types.contains(&"fill-blank"));
        assert!(!history.allowed_types.contains(&"numeric"));
    }

    #[test]
    fn unknown_subject_or_language_falls_back_to_fr() {
        assert_eq!(pack_for("language", None).id, "language-fr");
        assert_eq!(pack_for("", None).id, "language-fr");
        assert_eq!(pack_for("language", Some("it")).id, "language-fr");
        assert_eq!(pack_for("biology", None).id, "language-fr");
    }

    #[test]
    fn normalize_language_understands_codes_and_names() {
        assert_eq!(normalize_language("fr"), Some("fr"));
        assert_eq!(normalize_language("Французский"), Some("fr"));
        assert_eq!(normalize_language("en"), Some("en"));
        assert_eq!(normalize_language("английский"), Some("en"));
        assert_eq!(normalize_language("English"), Some("en"));
        assert_eq!(normalize_language("klingon"), None);
    }

    #[test]
    fn builtin_edito_maps_to_fr() {
        assert_eq!(pack_for_course_id("edito-a1").id, "language-fr");
        assert_eq!(pack_for_course_id("edito-a2").id, "language-fr");
    }

    #[test]
    fn fr_allowed_types_cover_legacy_list_plus_dictation() {
        // Исходный ALLOWED_EXERCISE_TYPES из handlers/courses.rs должен сохраниться целиком
        // (обратная совместимость валидации юнитов) + новый тип dictation.
        let legacy = [
            "theory", "grammar-quiz", "sentence-builder", "gender-quiz",
            "dialogue", "fill-blank", "number-quiz", "listening", "video",
        ];
        for t in legacy {
            assert!(LANGUAGE_FR.allowed_types.contains(&t), "legacy type '{t}' must stay allowed");
        }
        assert!(LANGUAGE_FR.allowed_types.contains(&"dictation"));
        // error-hunt пока вне списка (follow-up).
        assert!(!LANGUAGE_FR.allowed_types.contains(&"error-hunt"));
    }
}
