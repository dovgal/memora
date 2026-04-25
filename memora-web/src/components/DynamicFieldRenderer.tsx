"use client";

import { UseFormRegister, FieldErrors } from "react-hook-form";
import { FieldSchema } from "@/types/schema";
import { Calculator, Image as ImageIcon, Trash2 } from "lucide-react";
import AudioInput from "./AudioInput";
import NextImage from "next/image";

type AnyFieldValues = Record<string, unknown>;

interface Props {
    field: FieldSchema;
    index: number;
    register: UseFormRegister<AnyFieldValues>;
    errors: FieldErrors<AnyFieldValues>;
    update?: (index: number, obj: AnyFieldValues) => void;
    getValues: (path?: string) => unknown;
}

export default function DynamicFieldRenderer({ field, index, register, errors: _errors, update, getValues }: Props) {
    // Support legacy native fields falling back to the new field structure while migrating
    const isLegacyTerm = field.id === 'term';
    const isLegacyDef = field.id === 'definition';
    const isLegacyImg = field.id === 'image';

    // We bind to fieldsData.X generally, but if it's the specific legacy ones, we can bind to term/definition/imageUrl for backwards DTO compatibility if we want, OR we can stick 100% to fieldsData. Let's stick to fieldsData and the backend will manage mapping it, OR bind directly to form root depending on ID.
    // Let's bind directly to `flashcards.[index].[field.id]` if it's term/definition/image to ease the migration, otherwise `flashcards.[index].fieldsData.[field.id]`
    const formPath = (isLegacyTerm || isLegacyDef)
        ? `flashcards.${index}.${field.id}`
        : (isLegacyImg ? `flashcards.${index}.imageUrl` : `flashcards.${index}.fieldsData.${field.id}`);

    const renderInput = () => {
        switch (field.type) {
            case 'text':
                return (
                    <textarea
                        {...register(formPath)}
                        className="bg-transparent border-b-2 border-qz-border p-2 focus:outline-none focus:border-indigo-500 transition-colors text-lg resize-y min-h-[44px] w-full"
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                    />
                );
            case 'image':
                // We'll manage image later through specific UI, for now just show upload placeholder
                const currentImg = getValues(formPath);
                return (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-qz-border rounded-xl overflow-hidden relative group min-h-[100px] bg-qz-card/30 w-full mt-2">
                        {currentImg ? (
                            <>
                                <NextImage src={currentImg as string} alt="Field image" width={400} height={300} className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => update && update(index, { ...getValues(`flashcards.${index}`), [isLegacyImg ? 'imageUrl' : `fieldsData.${field.id}`]: null })}
                                    className="absolute top-2 right-2 bg-qz-bg/70 p-1.5 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </>
                        ) : (
                            <label className="flex-1 w-full h-full flex flex-col items-center justify-center gap-2 py-4 text-qz-text-muted hover:text-qz-text hover:bg-[#586380]/50 transition-all cursor-pointer">
                                <ImageIcon size={20} />
                                <span className="text-xs font-bold text-center leading-tight">Добавить фото</span>
                                {/* Note: we actually need a file handler here. We'll wire this in the parent. */}
                            </label>
                        )}
                    </div>
                );
            case 'audio':
                const audioValue = getValues(formPath);
                const resolvedAudioValue = audioValue === "__AUDIO_ON_SERVER__" 
                    ? `/api/audio/${getValues(`flashcards.${index}.id`)}/${field.id}`
                    : audioValue;

                return (
                    <AudioInput
                        value={resolvedAudioValue}
                        onChange={(val) => {
                            if (update) {
                                const currentCard = getValues(`flashcards.${index}`);
                                update(index, { ...currentCard, fieldsData: { ...(currentCard.fieldsData || {}), [field.id]: val } });
                            }
                        }}
                    />
                );


            case 'math':
                return (
                    <div className="mt-2">
                        <textarea
                            {...register(formPath)}
                            className="bg-qz-bg border border-qz-border rounded-lg p-3 font-mono text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-y min-h-[80px] w-full text-indigo-300"
                            placeholder="Entex LaTeX math forumla e.g. E = mc^2"
                        />
                        <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                            <Calculator size={14} /> Формула LaTeX
                        </div>
                    </div>
                )
            default:
                return null;
        }
    };

    return (
        <div className="flex-1 flex flex-col gap-1 w-full relative">
            <label className="text-xs uppercase font-bold tracking-wider text-zinc-500">
                {field.name}
            </label>
            {renderInput()}
            {/* Error display could be wired up here dynamically */}
        </div>
    );
}
