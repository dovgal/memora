"use client"
// Тренажёр «Заучивание»: план занятия строится по FSRS (просроченное — сперва,
// немного нового, интервальные повторы промахов внутри сессии), задания —
// либо проверенные судьёй с сервера (/api/sets/{id}/trainer/prepare), либо
// безопасные локальные (recognize/recall/listen/speak — никогда не грамматика).
// Логика — в memora-web/src/lib/trainer/, интерфейс — в memora-web/src/components/trainer/.

import React, { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { QChatProvider, WhyWrongButton } from "@/components/QChat"
import { useTrainerSession } from "@/lib/trainer/useTrainerSession"
import { TrainerHeader } from "@/components/trainer/TrainerHeader"
import { QuestionCard } from "@/components/trainer/QuestionCard"
import { SettingsSheet } from "@/components/trainer/SettingsSheet"
import { SessionSummaryView } from "@/components/trainer/SessionSummary"

export default function LearnModePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const router = useRouter()
    const [showSettings, setShowSettings] = useState(false)

    const t = useTrainerSession(id)

    // Возврат туда, откуда пришли: из курса — в курс. Иначе человек оказывается
    // в чужом наборе и не понимает, как вернуться к занятию.
    const closeSession = useCallback(() => {
        router.push(t.backLink ?? `/set/${id}`)
    }, [router, t.backLink, id])
    const closeSettings = useCallback(() => setShowSettings(false), [])

    if (t.status === 'loading' || t.status === 'finishing') {
        return (
            <div className="min-h-screen bg-qz-bg flex flex-col items-center justify-center gap-3 text-qz-text-muted">
                <Loader2 className="animate-spin text-qz-accent" size={36} />
                <p className="text-sm">{t.status === 'loading' ? 'Готовлю занятие…' : 'Подвожу итоги…'}</p>
            </div>
        )
    }

    if (t.status === 'empty' || t.status === 'error' || !t.set) {
        return (
            <div className="min-h-screen bg-qz-bg text-qz-text flex flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-qz-text-muted max-w-sm">
                    {t.status === 'error'
                        ? 'Не удалось открыть набор. Проверьте соединение и попробуйте ещё раз.'
                        : 'Чтобы заниматься, в наборе нужно хотя бы две карточки.'}
                </p>
                <button onClick={closeSession} className="text-qz-accent font-semibold py-2 px-4">Вернуться</button>
            </div>
        )
    }

    const { currentItem, currentCard, currentExercise } = t

    return (
        <QChatProvider setId={id}>
            <div className="min-h-screen bg-qz-bg text-qz-text flex flex-col">
                <TrainerHeader
                    position={t.status === 'finished' ? t.queueLength + 1 : t.position}
                    queueLength={t.queueLength}
                    combo={t.combo}
                    xpFloat={t.xpFloat}
                    onSettings={() => setShowSettings(true)}
                    onClose={closeSession}
                />

                {showSettings && (
                    <SettingsSheet settings={t.settings} onChange={t.setSettings} onClose={closeSettings} />
                )}

                <main
                    className="flex-1 flex flex-col items-center pt-3 px-4 sm:px-6 w-full max-w-2xl mx-auto"
                    style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    {t.status === 'finished' && t.summary ? (
                        <SessionSummaryView
                            summary={t.summary}
                            cards={t.set.flashcards}
                            schema={t.schema}
                            onClose={closeSession}
                            onRestart={t.restart}
                            closeLabel={t.backLink ? 'Вернуться к курсу' : 'Вернуться к набору'}
                        />
                    ) : currentItem && currentCard && currentExercise ? (
                        <>
                            <QuestionCard
                                // Новый пункт очереди — новое поле ввода: иначе при возврате
                                // карточки после промаха в поле остался бы прошлый ответ.
                                key={`${t.position}:${currentItem.cardId}:${currentItem.kind}`}
                                exercise={currentExercise}
                                card={currentCard}
                                showResult={t.showResult}
                                isCorrect={t.isCorrect}
                                lastAnswerText={t.lastAnswerText}
                                hintUsed={t.hintUsed}
                                coaching={t.coaching}
                                feedback={t.feedback}
                                grading={t.grading}
                                isLeech={t.isLeech}
                                paused={showSettings}
                                onSubmit={t.submitAnswer}
                                onUseHint={t.useHint}
                                onReplay={t.replay}
                                onNext={t.next}
                                onSkipSpeaking={t.skipSpeaking}
                            />
                            {t.showResult && t.isCorrect === false && (
                                <div className="w-full flex justify-start mt-3">
                                    <WhyWrongButton
                                        term={currentCard.term}
                                        correctAnswer={currentExercise.answer}
                                        userAnswer={t.lastAnswerText}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="animate-spin text-qz-accent" size={32} />
                        </div>
                    )}
                </main>
            </div>
        </QChatProvider>
    )
}
