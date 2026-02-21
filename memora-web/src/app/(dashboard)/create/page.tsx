"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2, Save, Loader2 } from "lucide-react"

// Zod schema for form validation
const flashcardSchema = z.object({
    term: z.string().min(1, "Term is required").max(255),
    definition: z.string().min(1, "Definition is required").max(1000),
})

const createSetSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(255),
    description: z.string().optional(),
    isPublic: z.boolean(),
    flashcards: z.array(flashcardSchema).min(2, "You must provide at least 2 flashcards"),
})

type CreateSetFormValues = z.infer<typeof createSetSchema>

export default function CreateSetPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<CreateSetFormValues>({
        resolver: zodResolver(createSetSchema),
        defaultValues: {
            title: "",
            description: "",
            isPublic: false,
            flashcards: [
                { term: "", definition: "" },
                { term: "", definition: "" },
            ],
        },
    })

    // Dynamic field array for flashcards
    const { fields, append, remove } = useFieldArray({
        name: "flashcards",
        control,
    })

    const onSubmit = async (data: CreateSetFormValues) => {
        setIsSubmitting(true)
        setSubmitError(null)

        try {
            const res = await fetch("/api/sets", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || "Failed to create set")
            }

            const responseData = await res.json()

            // Navigate to the newly created set viewing page
            router.push(`/set/${responseData.id}`)
        } catch (err: any) {
            setSubmitError(err.message)
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12 relative overflow-hidden">
            {/* Background aesthetics */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900 rounded-full mix-blend-multiply filter blur-[150px] opacity-30 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto relative z-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-white">Create a new study set</h1>
                        <p className="text-zinc-400 mt-2">Add term and definition pairs to generate flashcards.</p>
                    </div>
                    <button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isSubmitting ? "Saving..." : "Create Set"}
                    </button>
                </header>

                {submitError && (
                    <div className="mb-6 p-4 bg-red-900/40 border border-red-500 text-red-200 rounded-xl">
                        {submitError}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

                    {/* Metadata Section */}
                    <section className="bg-zinc-900/60 backdrop-blur border border-zinc-800 p-6 sm:p-8 rounded-2xl flex flex-col gap-6">
                        <div>
                            <input
                                type="text"
                                placeholder="Enter a title, like 'Biology - Chapter 22: Evolution'"
                                {...register("title")}
                                className="w-full bg-transparent border-b-2 border-zinc-700 text-2xl font-bold p-2 focus:outline-none focus:border-indigo-500 transition-colors text-white placeholder:text-zinc-600"
                            />
                            {errors.title && <p className="text-red-400 text-sm mt-2">{errors.title.message}</p>}
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="Add a description (optional)"
                                {...register("description")}
                                className="w-full bg-transparent border-b-2 border-zinc-700 text-lg p-2 focus:outline-none focus:border-indigo-500 transition-colors text-zinc-300 placeholder:text-zinc-600"
                            />
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register("isPublic")}
                                className="w-5 h-5 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500/50"
                            />
                            <span className="text-zinc-300">Make this set visible to everyone</span>
                        </label>
                    </section>

                    {/* Flashcards Section */}
                    <div className="space-y-6">
                        {fields.map((field, index) => (
                            <div
                                key={field.id}
                                className="bg-zinc-900/80 backdrop-blur border border-zinc-800 p-6 rounded-2xl transition-colors hover:border-zinc-700 relative group"
                            >
                                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
                                    <span className="font-bold text-zinc-500 select-none">{index + 1}</span>
                                    {fields.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                                            aria-label="Remove card"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 flex flex-col gap-2">
                                        <label className="text-xs uppercase font-bold tracking-wider text-zinc-500">Term</label>
                                        <input
                                            type="text"
                                            {...register(`flashcards.${index}.term`)}
                                            className="bg-transparent border-b-2 border-zinc-700 p-2 focus:outline-none focus:border-indigo-500 transition-colors text-lg"
                                            placeholder="e.g. Mitochondria"
                                        />
                                        {errors.flashcards?.[index]?.term && (
                                            <p className="text-red-400 text-sm">{errors.flashcards[index]?.term?.message}</p>
                                        )}
                                    </div>

                                    <div className="flex-1 flex flex-col gap-2">
                                        <label className="text-xs uppercase font-bold tracking-wider text-zinc-500">Definition</label>
                                        <textarea
                                            {...register(`flashcards.${index}.definition`)}
                                            className="bg-transparent border-b-2 border-zinc-700 p-2 focus:outline-none focus:border-indigo-500 transition-colors text-lg resize-y min-h-[44px]"
                                            placeholder="e.g. The powerhouse of the cell."
                                        />
                                        {errors.flashcards?.[index]?.definition && (
                                            <p className="text-red-400 text-sm">{errors.flashcards[index]?.definition?.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {errors.flashcards?.message && typeof errors.flashcards.message === 'string' && (
                            <p className="text-red-400 font-semibold">{errors.flashcards.message}</p>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center pb-20">
                        <button
                            type="button"
                            onClick={() => append({ term: "", definition: "" })}
                            className="group flex items-center justify-center gap-2 w-full md:w-auto bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-indigo-500 text-zinc-400 hover:text-indigo-400 font-bold py-6 px-12 rounded-2xl transition-all"
                        >
                            <Plus size={24} className="group-hover:scale-110 transition-transform" />
                            ADD CARD
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
