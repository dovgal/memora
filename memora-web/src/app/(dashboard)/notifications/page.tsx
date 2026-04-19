import React from "react";
import { Bell, Check, Clock } from "lucide-react";

export default function NotificationsPage() {
    return (
        <div className="min-h-full p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-qz-text flex items-center gap-3">
                        <Bell className="text-[#4255ff] w-8 h-8" />
                        Уведомления
                    </h1>
                    <button className="text-sm text-[#ffcd1f] hover:text-indigo-300 transition-colors flex items-center gap-2 font-medium bg-[#1a1a36] px-4 py-2 rounded-lg border border-qz-border-light">
                        <Check size={16} /> Пометить все как прочитанные
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Placeholder Notification 1 */}
                    <div className="bg-[#1a1a36] border border-qz-border-light rounded-xl p-5 flex items-start gap-4 transition-colors hover:bg-qz-card">
                        <div className="w-10 h-10 rounded-full bg-[#4255ff]/20 text-[#ffcd1f] flex items-center justify-center shrink-0 mt-1">
                            <Bell size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between">
                                <h3 className="text-qz-text font-semibold text-lg">Добро пожаловать в Memora!</h3>
                                <div className="flex items-center gap-1 text-xs text-zinc-500">
                                    <Clock size={12} />
                                    <span>Только что</span>
                                </div>
                            </div>
                            <p className="text-qz-text-muted mt-1 leading-relaxed">
                                Мы рады видеть вас здесь. Начните с создания своего первого модуля карточек или воспользуйтесь функцией генерации с помощью ИИ.
                            </p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-pink-500 mt-2 shrink-0"></div>
                    </div>

                    {/* Placeholder Notification 2 */}
                    <div className="bg-[#1a1a36] border border-qz-border-light rounded-xl p-5 flex items-start gap-4 transition-colors hover:bg-qz-card opacity-75">
                        <div className="w-10 h-10 rounded-full bg-qz-card text-qz-text-muted flex items-center justify-center shrink-0 mt-1">
                            <Check size={20} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between">
                                <h3 className="text-qz-text font-semibold text-lg">Модуль успешно импортирован</h3>
                                <div className="flex items-center gap-1 text-xs text-zinc-500">
                                    <Clock size={12} />
                                    <span>Вчера</span>
                                </div>
                            </div>
                            <p className="text-qz-text-muted mt-1 leading-relaxed">
                                Ваш модуль был успешно импортирован и теперь доступен в вашей библиотеке.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
