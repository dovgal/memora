import Link from "next/link";
import {
    Home,
    Library,
    Plus,
    Search,
    GraduationCap,
    UserRound,
    BookOpen
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EinkToggle } from "@/components/EinkToggle";
import { SkinToggle } from "@/components/SkinToggle";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { FolderSummaryResponse } from "@/types/schema";

async function getUserFolders(token: string): Promise<FolderSummaryResponse[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    try {
        const res = await fetch(`${apiUrl}/api/folders`, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role || "student";
    const initial = session?.user?.email ? session.user.email[0].toUpperCase() : "U";

    let folders: FolderSummaryResponse[] = [];
    if (session && session.id_token) {
        folders = await getUserFolders(session.id_token);
    }

    return (
        <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
            <DashboardSidebar role={role} folders={folders.map(f => ({ id: f.id, name: f.name }))} />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
                {/* Header */}
                <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
                    <div className="flex-1 max-w-2xl px-4 md:px-0">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search study sets, folders, users..."
                                className="w-full bg-secondary border border-transparent focus:border-primary/50 rounded-full py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all focus:bg-background focus:shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pl-4">
                        <ThemeToggle />
                        <EinkToggle />
                        <SkinToggle />
                        
                        {/* Restoring the global Create button */}
                        <Link href="/create" className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-[#4255ff] hover:bg-indigo-400 text-white transition-colors shadow-lg shadow-indigo-500/20">
                            <Plus className="w-5 h-5" />
                        </Link>

                        <button className="hidden sm:block px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold rounded-full text-sm transition-colors shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                            Upgrade
                        </button>

                        <div className="relative group">
                            <button className="w-9 h-9 rounded-full bg-[#4255ff] text-white flex items-center justify-center font-medium border-2 border-transparent hover:border-zinc-500 transition-all cursor-pointer shadow-indigo-500/50 shadow-lg">
                                {initial}
                            </button>
                            <div className="absolute right-0 top-full mt-2 w-48 bg-qz-card border border-[#262c40] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all origin-top-right transform -translate-y-2 group-hover:translate-y-0 p-2 z-50">
                                <div className="px-3 py-2 border-b border-[#262c40] mb-2">
                                    <p className="text-sm font-medium text-qz-text">{session?.user?.email || "User"}</p>
                                    <p className="text-xs text-[#8e95ae] capitalize">{role}</p>
                                </div>
                                <LogoutButton />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto w-full bg-background pb-16 md:pb-0">
                    {children}
                </div>

                {/* Мобильная нижняя навигация: выход из любого курса на телефоне */}
                <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
                    <Link href={`/dashboard/${role}`} className="flex flex-col items-center gap-0.5 py-2 px-2 text-qz-text-muted hover:text-[#4255ff] transition-colors">
                        <Home className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Главная</span>
                    </Link>
                    <Link href="/courses" className="flex flex-col items-center gap-0.5 py-2 px-2 text-qz-text-muted hover:text-[#4255ff] transition-colors">
                        <GraduationCap className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Каталог</span>
                    </Link>
                    <Link href="/cabinet" className="flex flex-col items-center gap-0.5 py-2 px-2 text-qz-text-muted hover:text-[#4255ff] transition-colors">
                        <UserRound className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Кабинет</span>
                    </Link>
                    <Link href="/library" className="flex flex-col items-center gap-0.5 py-2 px-2 text-qz-text-muted hover:text-[#4255ff] transition-colors">
                        <Library className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Наборы</span>
                    </Link>
                    <Link href="/books" className="flex flex-col items-center gap-0.5 py-2 px-2 text-qz-text-muted hover:text-[#4255ff] transition-colors">
                        <BookOpen className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">Книги</span>
                    </Link>
                </nav>
            </main>
        </div>
    );
}
