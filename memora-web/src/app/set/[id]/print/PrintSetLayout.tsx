"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { SetResponse } from "@/types/schema"
import { ChevronLeft, Printer } from "lucide-react"
import Link from "next/link"

type LayoutType = "table" | "glossary" | "small" | "medium" | "large"

export default function PrintSetLayout({ set }: { set: SetResponse }) {
    const router = useRouter()
    const [layout, setLayout] = useState<LayoutType>("маленький" as any) // Based on user image, starting with 'маленький' or 'table'
    const [swap, setSwap] = useState(false)

    // Actually the values should be English internally, let's map them
    const actualLayout = layout as any as LayoutType;

    // We'll manage state internally as English, display as Russian
    const [internalLayout, setInternalLayout] = useState<LayoutType>("small")

    const handlePrint = () => {
        window.print()
    }

    const renderPrintableContent = () => {
        const cards = set.flashcards

        const ContentHeader = () => (
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-zinc-200">
                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center font-bold text-2xl shrink-0">
                    M
                </div>
                <div>
                    <h1 className="text-xl font-bold text-black m-0">{set.title}</h1>
                    <p className="text-sm text-zinc-500 m-0">
                        Изучать в Memora: {typeof window !== 'undefined' ? `${window.location.host}/set/${set.id}` : ''}
                    </p>
                </div>
            </div>
        )

        if (internalLayout === "table") {
            return (
                <div className="text-black bg-white">
                    <ContentHeader />
                    <table className="w-full border-collapse">
                        <tbody>
                            {cards.map((card, idx) => (
                                <tr key={card.id} className="border-b border-zinc-200">
                                    <td className="py-3 px-4 w-1/2 align-top text-lg">
                                        {swap ? card.definition : card.term}
                                    </td>
                                    <td className="py-3 px-4 w-1/2 align-top text-lg text-zinc-600">
                                        {swap ? card.term : card.definition}
                                        {card.imageUrl && !swap && (
                                            <div className="mt-2"><img src={card.imageUrl} alt="Flashcard" className="max-w-[150px] max-h-[150px] object-contain rounded" /></div>
                                        )}
                                        {card.imageUrl && swap && (
                                            <div className="mt-2"><img src={card.imageUrl} alt="Flashcard" className="max-w-[150px] max-h-[150px] object-contain rounded" /></div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
        }

        if (internalLayout === "glossary") {
            return (
                <div className="text-black bg-white">
                    <ContentHeader />
                    <div className="space-y-4">
                        {cards.map((card, idx) => (
                            <div key={card.id} className="flex gap-4 border-b border-zinc-100 pb-4">
                                <div className="w-1/3 font-bold text-lg">
                                    {swap ? card.definition : card.term}
                                </div>
                                <div className="w-2/3 text-lg text-zinc-700">
                                    {swap ? card.term : card.definition}
                                    {card.imageUrl && (
                                        <div className="mt-2"><img src={card.imageUrl} alt="Flashcard" className="max-w-[150px] max-h-[150px] object-contain rounded" /></div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }

        // Card Layouts (small, medium, large)
        let minHeight = "min-h-[8rem]" // h-32 (128px)
        let fontSizeTerm = "text-lg"
        let fontSizeDef = "text-base"

        if (internalLayout === "medium") {
            minHeight = "min-h-[12rem]" // h-48 (192px)
            fontSizeTerm = "text-2xl"
            fontSizeDef = "text-xl"
        } else if (internalLayout === "large") {
            minHeight = "min-h-[16rem]" // h-64 (256px)
            fontSizeTerm = "text-3xl"
            fontSizeDef = "text-2xl"
        }

        return (
            <div className="text-black bg-white">
                <ContentHeader />
                <div className="flex flex-col">
                    {cards.map((card, idx) => (
                        <div key={card.id} className={`flex w-full ${minHeight} border-x border-b border-zinc-300 break-inside-avoid ${idx === 0 ? 'border-t' : ''}`}>
                            {/* Front of card (left) */}
                            <div className="w-1/2 border-r border-zinc-300 p-6 flex flex-col justify-center items-center text-center">
                                <span className={`${fontSizeTerm} font-bold text-black`}>
                                    {swap ? card.definition : card.term}
                                </span>
                            </div>
                            {/* Back of card (right) */}
                            <div className="w-1/2 p-6 flex flex-col justify-center items-center text-center">
                                <span className={`${fontSizeDef} text-zinc-800`}>
                                    {swap ? card.term : card.definition}
                                </span>
                                {card.imageUrl && (
                                    <div className="mt-4 flex justify-center shrink-0">
                                        <img src={card.imageUrl} alt="Flashcard" className="max-h-[100px] object-contain rounded" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <>
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-area, #print-area * {
                        visibility: visible;
                    }
                    #print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    @page {
                        margin: 1cm;
                    }
                }
            `}</style>

            <div className="min-h-screen bg-[#0a0a1a] text-white overflow-hidden flex flex-col items-center">
                {/* Header */}
                <header className="w-full max-w-[1400px] mx-auto p-4 flex items-center justify-between">
                    <Link href={`/set/${set.id}`} className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                        <ChevronLeft size={20} /> Назад к модулю
                    </Link>
                </header>

                {/* Main Content */}
                <div className="w-full max-w-[1400px] mx-auto px-4 pb-12 flex flex-col lg:flex-row gap-8 items-start h-[calc(100vh-80px)]">

                    {/* Left Panel: Settings */}
                    <div className="w-full lg:w-[400px] shrink-0">
                        <h2 className="text-3xl font-bold mb-6">Печать</h2>

                        <div className="bg-[#111126] border border-[#2a2a4d] rounded-xl overflow-hidden">
                            <div className="p-6">
                                {/* Section 1 */}
                                <div className="mb-8">
                                    <h3 className="font-bold text-lg mb-4">1. Выберите структуру</h3>
                                    <div className="space-y-3">
                                        {[
                                            { id: "table", label: "таблица" },
                                            { id: "glossary", label: "глоссарий" },
                                            { id: "small", label: "маленький" },
                                            { id: "medium", label: "средний" },
                                            { id: "large", label: "большой" },
                                        ].map((opt) => (
                                            <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${internalLayout === opt.id ? 'border-indigo-500' : 'border-zinc-500 group-hover:border-zinc-400'}`}>
                                                    {internalLayout === opt.id && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="layout"
                                                    value={opt.id}
                                                    checked={internalLayout === opt.id}
                                                    onChange={() => setInternalLayout(opt.id as LayoutType)}
                                                    className="hidden"
                                                />
                                                <span className="text-lg">{opt.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Section 2 */}
                                <div className="mb-8">
                                    <h3 className="font-bold text-lg mb-4">2. Настройте параметры</h3>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${swap ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-500 group-hover:border-zinc-400'}`}>
                                            {swap && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={swap}
                                            onChange={(e) => setSwap(e.target.checked)}
                                            className="hidden"
                                        />
                                        <span className="text-zinc-300">Поменять местами термины и определения</span>
                                    </label>
                                </div>

                                {/* Section 3 */}
                                <div>
                                    <h3 className="font-bold text-lg mb-4">3. Нажмите значок принтера, чтобы распечатать PDF</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Interactive Preview */}
                    <div className="flex-1 w-full bg-[#1e1e24] rounded-t-xl rounded-b-xl overflow-hidden shadow-2xl flex flex-col max-h-full border border-black h-full">

                        {/* Fake Browser Toolbar for Preview */}
                        <div className="bg-[#2b2b36] h-12 flex items-center justify-between px-4 shrink-0">
                            <div className="flex items-center gap-4 text-zinc-400">
                                <span className="text-sm font-semibold tracking-widest text-[#5c5c6c]">ПРЕДПРОСМОТР</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handlePrint} className="p-2 hover:bg-zinc-600/50 rounded transition-colors text-white" title="Распечатать PDF">
                                    <Printer size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Document Viewport */}
                        <div className="flex-1 bg-[#1e1e24] overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
                            <div className="max-w-4xl mx-auto shadow-2xl relative">

                                {/* The actual printable area */}
                                <div id="print-area" className="bg-white min-h-[842px] w-full mx-auto shadow-xl p-8 md:p-12 text-black font-sans box-border" style={{ aspectRatio: '1 / 1.414' }}>
                                    {renderPrintableContent()}
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    )
}
