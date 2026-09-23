// Типы приложения: реэкспорт сгенерированных из Rust (generated.ts, НЕ редактировать
// руками — перезаписывается `make types`) + ручные типы фронтенда ниже.
// Исторически ручные типы дописывались прямо в сгенерированный файл, и каждая
// регенерация их стирала (июньский CI падал именно на этом).

export * from './generated';

// ---------- Ручные типы фронтенда ----------

export type FieldType = 'text' | 'image' | 'audio' | 'math';

export type FieldSide = 'front' | 'back';

export interface FieldSettings {
	language?: string;
	ttsEnabled?: boolean;
	ttsVoice?: string;
	/** Ширина поля в раскладке карточки: 'full' (на всю строку) или 'half' (половина — можно ставить поля в ряд слева/справа). По умолчанию 'full'. */
	width?: 'full' | 'half';
	[key: string]: string | boolean | undefined;
}

export interface FieldSchema {
	id: string;
	name: string;
	type: FieldType;
	side: FieldSide;
	order: number;
	settings: FieldSettings;
}

export type FieldData = Record<string, string | boolean | null | undefined>;

export interface AIExercise {
    id: string;
    cardId: string;
    type: string;
    question: string;
    targetField: string;
    context?: string;
}

// ---------- AI Content Creator ----------
// Ручные типы: бэкенд (handlers::creator) намеренно не типшарит их — модель
// не соблюдает JSON Schema, ключи диктуются прямо в промпте и разбираются
// null-толерантно на сервере, а на фронт уже приходит провалидированный ответ.

export type CreatorLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type CreatorExtractMode = 'words' | 'phrases' | 'both';

/** Общие языковые/уровневые настройки — без `count`: он осмыслен только при
 * первом анализе, регенерация одной карточки его не принимает. */
export interface CreatorSettings {
	sourceLanguage: string; // '' или 'auto' — определить самим
	translationLanguage: string; // по умолчанию 'ru'
	level: CreatorLevel;
	extract: CreatorExtractMode;
	learningGoal: string;
}

export interface CreatorAnalyzeRequest extends CreatorSettings {
	content: string;
	count: number; // 10..40
}

export interface CreatorCard {
	term: string;
	definition: string;
	partOfSpeech: string;
	example: string;
	exampleTranslation: string;
	ipa: string;
}

export interface CreatorAnalyzeResponse {
	proposedTitle: string;
	proposedDescription: string;
	cards: CreatorCard[];
	skippedDuplicates: number;
	skippedInvalid: number;
}

export interface CreatorRegenerateCardRequest extends CreatorSettings {
	content: string;
	term: string;
	avoidTerms: string[];
}

// ---------- Оверрайды сгенерированных типов ----------
// В Rust эти поля — serde_json::Value; здесь уточняем структуру (FieldSchema/FieldData).
// Явный экспорт имеет приоритет над `export *` из generated.ts.

export interface CreateFlashcardRequest {
	term: string;
	definition: string;
	imageUrl?: string;
	fieldsData: FieldData;
}

export interface CreateSetRequest {
	title: string;
	description?: string;
	isPublic: boolean;
	fieldsSchema: FieldSchema[];
	flashcards: CreateFlashcardRequest[];
}

export interface FlashcardResponse {
	id: string;
	term: string;
	definition: string;
	imageUrl?: string;
	orderIndex: number;
	fieldsData: FieldData;
}

export interface SetSummaryResponse {
	id: string;
	title: string;
	description?: string;
	fieldsSchema: FieldSchema[];
	flashcardCount: number;
	createdAt: string;
}

export interface SetResponse {
	id: string;
	title: string;
	description?: string;
	creatorId: string;
	fieldsSchema: FieldSchema[];
	flashcards: FlashcardResponse[];
}

export interface UpdateFlashcardRequest {
	id?: string;
	term: string;
	definition: string;
	imageUrl?: string;
	fieldsData: FieldData;
}

export interface UpdateSetRequest {
	title: string;
	description?: string;
	isPublic: boolean;
	fieldsSchema: FieldSchema[];
	flashcards: UpdateFlashcardRequest[];
}

// FolderResponse ссылается на SetSummaryResponse — оверрайдим вместе с ним.
export interface FolderResponse {
	id: string;
	name: string;
	description?: string;
	createdAt: string;
	sets: SetSummaryResponse[];
}
