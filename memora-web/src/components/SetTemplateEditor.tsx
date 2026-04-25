"use client";

import { useState } from "react";
import { X, Plus, GripVertical, Settings2, Trash2 } from "lucide-react";
import { FieldSchema, FieldType, FieldSide } from "@/types/schema";

interface Props {
    fields: FieldSchema[];
    onChange: (fields: FieldSchema[]) => void;
    onClose: () => void;
}

const FIELD_TYPES: { type: FieldType; label: string; description: string }[] = [
    { type: 'text', label: 'Текст', description: 'Обычный текст с выбором языка' },
    { type: 'image', label: 'Изображение', description: 'Загрузка картинки' },
    { type: 'audio', label: 'Аудио', description: 'Загрузка или запись с микрофона' },
    { type: 'math', label: 'Математика', description: 'Редактор формул (LaTeX)' },
];

const LANGUAGES = [
    { code: 'default', label: 'По умолчанию' },
    { code: 'en', label: 'Английский' },
    { code: 'ru', label: 'Русский' },
    { code: 'es', label: 'Испанский' },
    { code: 'fr', label: 'Французский' },
    { code: 'de', label: 'Немецкий' },
];

const INWORLD_VOICES_BY_LANG: Record<string, { code: string; label: string }[]> = {
    en: [
        { code: 'Clive', label: 'Clive (British Male)' },
        { code: 'Aria', label: 'Aria (Calm Female)' },
        { code: 'Nolan', label: 'Nolan (Young Male)' },
        { code: 'Bella', label: 'Bella (Energetic Female)' },
        { code: 'Abby', label: 'Abby (Young Female)' },
        { code: 'Alex', label: 'Alex (Middle Aged Male)' },
        { code: 'Amina', label: 'Amina (Middle Aged Female)' },
        { code: 'Brandon', label: 'Brandon (Bold Male)' },
        { code: 'Brian', label: 'Brian (Friendly Male)' },
        { code: 'Callum', label: 'Callum (Casual Male)' },
        { code: 'Carter', label: 'Carter (Intense Male)' },
        { code: 'Cedric', label: 'Cedric (Crisp Male)' },
        { code: 'Celeste', label: 'Celeste (Soft Female)' },
        { code: 'Chloe', label: 'Chloe (Thoughtful Female)' },
        { code: 'Claire', label: 'Claire (Warm Female)' },
        { code: 'Anjali', label: 'Anjali (Professional Female)' },
        { code: 'Arjun', label: 'Arjun (Smooth Male)' },
        { code: 'Ashley', label: 'Ashley (Warm Female)' },
        { code: 'Avery', label: 'Avery (Youthful Male)' },
        { code: 'Bianca', label: 'Bianca (Deep Female)' },
        { code: 'Blake', label: 'Blake (Intimate Male)' },
        { code: 'Craig', label: 'Craig (Posh Male)' },
        { code: 'Damon', label: 'Damon (Calm Male)' },
        { code: 'Darlene', label: 'Darlene (Soothing Female)' },
        { code: 'Deborah', label: 'Deborah (Gentle Female)' },
        { code: 'Dennis', label: 'Dennis (Outgoing Male)' },
        { code: 'Derek', label: 'Derek (Steady Male)' },
        { code: 'Dominus', label: 'Dominus (Robotic Male)' },
        { code: 'Duncan', label: 'Duncan (Warm Male)' },
        { code: 'Edward', label: 'Edward (Emphatic Male)' },
        { code: 'Eleanor', label: 'Eleanor (Gentle Female)' },
    ],
    fr: [
        { code: 'Alain', label: 'Alain (Deep Male)' },
        { code: 'Étienne', label: 'Étienne (Robust Male)' },
        { code: 'Hélène', label: 'Hélène (Expressive Female)' },
        { code: 'Mathieu', label: 'Mathieu (Robust Male)' },
    ],
    de: [
        { code: 'Johanna', label: 'Johanna (Rich Female)' },
        { code: 'Josef', label: 'Josef (Resonant Male)' },
    ],
    ru: [
        { code: 'Tatiana', label: 'Tatiana (Female)' },
        { code: 'Maxim', label: 'Maxim (Male)' },
    ],
    es: [
        { code: 'Carmen', label: 'Carmen (Female)' },
        { code: 'Diego', label: 'Diego (Male)' },
    ],
    default: [
        { code: 'Clive', label: 'Clive (English - default male)' },
    ]
};

export default function SetTemplateEditor({ fields, onChange, onClose }: Props) {
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

    const handleAddField = (side: FieldSide) => {
        const newField: FieldSchema = {
            id: `field_${crypto.randomUUID()}`,
            name: 'НОВОЕ ПОЛЕ',
            type: 'text',
            side: side,
            order: fields.filter(f => f.side === side).length + 1,
            settings: { language: 'default' }
        };
        onChange([...fields, newField]);
        setEditingFieldId(newField.id);
    };

    const handleRemoveField = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updatedFields = fields.filter(f => f.id !== id);
        // Re-calculate order
        updatedFields.forEach((f) => {
            if (f.side === 'front') f.order = updatedFields.filter(f2 => f2.side === 'front').indexOf(f) + 1;
            if (f.side === 'back') f.order = updatedFields.filter(f2 => f2.side === 'back').indexOf(f) + 1;
        });
        onChange(updatedFields);
        if (editingFieldId === id) setEditingFieldId(null);
    };

    const handleUpdateField = (id: string, updates: Partial<FieldSchema>) => {
        onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const renderFieldList = (side: FieldSide) => {
        const sideFields = fields.filter(f => f.side === side).sort((a, b) => a.order - b.order);

        return (
            <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center bg-qz-card/50 p-3 rounded-lg border border-qz-border">
                    <h3 className="font-semibold text-qz-text-muted">
                        {side === 'front' ? 'Лицевая сторона' : 'Обратная сторона'}
                    </h3>
                    <button
                        onClick={() => handleAddField(side)}
                        className="flex items-center gap-1 text-sm bg-[#586380] hover:bg-[#586380] px-3 py-1.5 rounded-md transition-colors text-qz-text"
                    >
                        <Plus size={16} /> Добавить
                    </button>
                </div>

                {sideFields.length === 0 ? (
                    <div className="text-center p-6 border-2 border-dashed border-qz-border-light rounded-xl text-zinc-500">
                        Нет полей на этой стороне
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sideFields.map((field) => (
                            <div
                                key={field.id}
                                onClick={() => setEditingFieldId(field.id)}
                                className={`flex items-center gap-3 p-4 rounded-xl border transition-colors cursor-pointer group ${editingFieldId === field.id ? 'bg-qz-bg border-indigo-500/50' : 'bg-qz-bg/50 border-qz-border-light hover:border-qz-border hover:bg-qz-card/30'}`}
                            >
                                <div className="text-zinc-600 cursor-grab active:cursor-grabbing">
                                    <GripVertical size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-qz-text mb-1 uppercase text-sm tracking-wider">{field.name}</div>
                                    <div className="flex items-center gap-2 text-xs text-qz-text-muted">
                                        <span className="bg-qz-card px-2 py-0.5 rounded">{FIELD_TYPES.find(t => t.type === field.type)?.label || field.type}</span>
                                        {field.type === 'text' && (
                                            <select
                                                value={field.settings.language || 'default'}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => handleUpdateField(field.id, { settings: { ...field.settings, language: e.target.value } })}
                                                className="bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded border-none text-[10px] outline-none cursor-pointer hover:bg-indigo-900/60 transition-colors"
                                            >
                                                {LANGUAGES.map(lang => (
                                                    <option key={lang.code} value={lang.code} className="bg-qz-bg">{lang.label}</option>
                                                ))}
                                            </select>
                                        )}
                                        {field.type === 'text' && field.settings.ttsEnabled && (
                                            <span className="bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1">
                                                TTS: {field.settings.ttsVoice || 'Clive'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="p-2 text-zinc-500 hover:text-qz-text transition-colors"
                                    >
                                        <Settings2 size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => handleRemoveField(field.id, e)}
                                        className="p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const editingField = fields.find(f => f.id === editingFieldId);

    return (
        <div className="fixed inset-0 z-[100] bg-qz-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-5xl bg-qz-bg rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 flex flex-col md:flex-row min-h-[600px] max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

                {/* LEFT SIDE: List of Fields */}
                <div className="flex-1 border-r border-white/5 flex flex-col">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-qz-card">
                        <h2 className="text-xl font-bold text-qz-text flex items-center gap-2">
                            <Settings2 className="text-[#ffcd1f]" /> Шаблон Карточки
                        </h2>
                        <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-qz-text-muted cursor-pointer lg:hidden">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700">
                        {renderFieldList('front')}
                        {renderFieldList('back')}
                    </div>

                    <div className="p-6 border-t border-white/5 bg-qz-card">
                        <button
                            onClick={onClose}
                            className="w-full py-4 bg-[#4255ff] hover:bg-[#4255ff] text-white font-bold rounded-xl transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                        >
                            Готово
                        </button>
                    </div>
                </div>

                {/* RIGHT SIDE: Field Details Editor */}
                <div className="hidden md:flex flex-1 flex-col bg-qz-card/50 relative">
                    {editingField ? (
                        <div className="absolute inset-0 overflow-y-auto p-8 animate-in slide-in-from-right-8 duration-200">
                            <div className="flex justify-between items-start mb-8">
                                <h3 className="text-2xl font-bold text-qz-text border-b border-qz-border-light pb-4 w-full">Настройки поля</h3>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-qz-text-muted mb-2 uppercase tracking-wider">Название поля (Напр: ТЕРМИН, ФРАЗА, FR)</label>
                                    <input
                                        type="text"
                                        value={editingField.name}
                                        onChange={(e) => handleUpdateField(editingField.id, { name: e.target.value.toUpperCase() })}
                                        className="w-full bg-qz-bg border border-indigo-500/30 rounded-xl p-4 text-qz-text focus:outline-none focus:border-indigo-500 transition-colors font-bold"
                                        placeholder="Введите название..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-qz-text-muted mb-2 uppercase tracking-wider">Сторона</label>
                                    <div className="flex bg-qz-bg rounded-xl overflow-hidden border border-qz-border-light">
                                        <button
                                            onClick={() => handleUpdateField(editingField.id, { side: 'front' })}
                                            className={`flex-1 p-3 text-center font-bold transition-colors ${editingField.side === 'front' ? 'bg-[#4255ff] text-white' : 'text-zinc-500 hover:bg-qz-card'}`}
                                        >
                                            Лицевая
                                        </button>
                                        <button
                                            onClick={() => handleUpdateField(editingField.id, { side: 'back' })}
                                            className={`flex-1 p-3 text-center font-bold transition-colors ${editingField.side === 'back' ? 'bg-[#4255ff] text-white' : 'text-zinc-500 hover:bg-qz-card'}`}
                                        >
                                            Обратная
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-qz-text-muted mb-2 uppercase tracking-wider">Тип данных</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {FIELD_TYPES.map(t => (
                                            <div
                                                key={t.type}
                                                onClick={() => handleUpdateField(editingField.id, { type: t.type })}
                                                className={`p-4 rounded-xl border cursor-pointer transition-all ${editingField.type === t.type ? 'border-indigo-500 bg-[#4255ff]/10' : 'border-qz-border-light bg-qz-bg hover:border-zinc-600'}`}
                                            >
                                                <div className="font-bold text-qz-text mb-1">{t.label}</div>
                                                <div className="text-xs text-zinc-500">{t.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {editingField.type === 'text' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 border-t border-qz-border-light pt-6 mt-6">
                                        <h4 className="font-bold text-qz-text text-lg">Дополнительные опции</h4>

                                        <div>
                                            <label className="block text-sm font-semibold text-qz-text-muted mb-2 uppercase tracking-wider">Язык (клавиатура / проверка)</label>
                                            <select
                                                value={editingField.settings.language || 'default'}
                                                onChange={(e) => {
                                                    const newLang = e.target.value;
                                                    const newVoices = INWORLD_VOICES_BY_LANG[newLang === 'default' ? 'en' : newLang] || INWORLD_VOICES_BY_LANG['en'];
                                                    handleUpdateField(editingField.id, { 
                                                        settings: { 
                                                            ...editingField.settings, 
                                                            language: newLang,
                                                            ttsVoice: editingField.settings.ttsEnabled ? newVoices[0].code : undefined
                                                        } 
                                                    });
                                                }}
                                                className="w-full bg-qz-bg border border-qz-border-light rounded-xl p-4 text-qz-text focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                                            >
                                                {LANGUAGES.map(lang => (
                                                    <option key={lang.code} value={lang.code}>{lang.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="bg-qz-bg border border-qz-border-light rounded-xl p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <div className="font-bold text-qz-text flex items-center gap-2">Озвучка Inworld TTS</div>
                                                    <div className="text-xs text-qz-text-muted mt-1">AI будет читать текст этого поля</div>
                                                </div>

                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={!!editingField.settings.ttsEnabled}
                                                        onChange={(e) => handleUpdateField(editingField.id, {
                                                            settings: {
                                                                ...editingField.settings,
                                                                ttsEnabled: e.target.checked,
                                                                ttsVoice: e.target.checked ? (editingField.settings.ttsVoice || 'Clive') : undefined
                                                            }
                                                        })}
                                                    />
                                                    <div className="w-11 h-6 bg-[#586380] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                </label>
                                            </div>

                                            {editingField.settings.ttsEnabled && (
                                                <div className="mt-4 pt-4 border-t border-qz-border-light animate-in fade-in slide-in-from-top-2">
                                                    <label className="block text-xs font-semibold text-qz-text-muted mb-2 uppercase tracking-wider">Выбор голоса</label>
                                                    <select
                                                        value={editingField.settings.ttsVoice || ''}
                                                        onChange={(e) => handleUpdateField(editingField.id, { settings: { ...editingField.settings, ttsVoice: e.target.value } })}
                                                        className="w-full bg-qz-bg border border-qz-border rounded-lg p-3 text-qz-text focus:outline-none focus:border-emerald-500 transition-colors appearance-none text-sm"
                                                    >
                                                        {(INWORLD_VOICES_BY_LANG[editingField.settings.language === 'default' ? 'en' : (editingField.settings.language || 'en')] || INWORLD_VOICES_BY_LANG['en']).map(voice => (
                                                            <option key={voice.code} value={voice.code}>{voice.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-20 h-20 bg-qz-card/50 rounded-full flex items-center justify-center mb-6 text-zinc-600">
                                <Settings2 size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-qz-text-muted mb-2">Выберите поле</h3>
                            <p className="text-zinc-600 max-w-sm">Нажмите на поле слева, чтобы настроить его параметры: изменить название, тип или язык.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
