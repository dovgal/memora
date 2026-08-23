'use client';
// Боковое меню панели: разворачивается и сворачивается в узкую полоску.
//
// Внутри курса или читалки сворачивается само: там нужен текст, а не
// навигация. На планшете в альбомной ориентации меню в 256 пикселей забирало
// четверть ширины без пользы.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import {
  Home, Library, Users, Bell, Plus, Folder, Sparkles,
  GraduationCap, UserRound, Trophy, BookOpen, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import {
  isImmersive, setSidebarCollapsed, sidebarServerSnapshot, sidebarSnapshot, subscribeSidebar,
} from '@/lib/ui/sidebarPref';

export interface SidebarFolder { id: string; name: string }

export function DashboardSidebar({ role, folders }: { role: string; folders: SidebarFolder[] }) {
  const pathname = usePathname() ?? '';
  const prefs = useSyncExternalStore(subscribeSidebar, sidebarSnapshot, sidebarServerSnapshot);

  const mode = isImmersive(pathname) ? 'immersive' : 'normal';
  const collapsed = prefs[mode];

  const nav = [
    { href: `/dashboard/${role}`, icon: Home, label: 'Главная' },
    { href: '/courses', icon: GraduationCap, label: 'Каталог курсов' },
    { href: '/cabinet', icon: UserRound, label: 'Мой кабинет' },
    { href: '/family', icon: Trophy, label: 'Семейное табло' },
    { href: '/library', icon: Library, label: 'Your Library' },
    { href: '/books', icon: BookOpen, label: 'Чтение книг' },
    { href: '/groups', icon: Users, label: 'Study Groups' },
    { href: '/notifications', icon: Bell, label: 'Notifications', dot: true },
  ];

  return (
    <aside
      className={`bg-card border-r border-border flex-col pt-4 hidden md:flex transition-[width] duration-200 shrink-0 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Шапка: логотип и кнопка сворачивания */}
      <div className={`mb-6 flex items-center ${collapsed ? 'flex-col gap-3 px-2' : 'px-4 gap-3'}`}>
        <Link href={`/dashboard/${role}`} className="flex items-center gap-3 min-w-0" title="Memora">
          <span className="w-8 h-8 bg-[#4255ff] rounded-lg flex items-center justify-center font-bold text-white shrink-0">
            M
          </span>
          {!collapsed && <span className="text-xl font-bold text-qz-text tracking-wide truncate">Memora</span>}
        </Link>
        {!collapsed && <div className="flex-1" />}
        <button
          onClick={() => setSidebarCollapsed(mode, !collapsed)}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          className="p-1.5 rounded-lg text-qz-text-muted hover:text-foreground hover:bg-qz-card transition-colors shrink-0"
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto space-y-6 scrollbar-thin ${collapsed ? 'px-2' : 'px-4'}`}>
        <nav className="space-y-1">
          {nav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg font-medium transition-colors hover:bg-qz-card text-qz-text-muted relative ${
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.dot && (
                <span className={`absolute w-2 h-2 bg-pink-500 rounded-full ${collapsed ? 'top-1.5 right-2.5' : 'top-2 left-6'}`} />
              )}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          ))}

          <Link
            href="/creator"
            title={collapsed ? 'AI Creator' : undefined}
            className={`flex items-center bg-[#4255ff]/10 text-qz-accent hover:bg-[#4255ff]/20 rounded-xl transition-all font-bold border border-indigo-500/20 group ${
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
            }`}
          >
            <Sparkles className="w-5 h-5 shrink-0 group-hover:rotate-12 transition-transform" />
            {!collapsed && 'AI Creator'}
          </Link>
        </nav>

        {/* Папки в полоску не помещаются — показываем только развёрнутым. */}
        {!collapsed && (
          <div className="pt-4 border-t border-qz-border-light">
            <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Your Folders</h3>
            <nav className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
              {folders.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-500 italic">No folders yet</div>
              ) : (
                folders.map(folder => (
                  <Link key={folder.id} href={`/folder/${folder.id}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-qz-card rounded-lg transition-colors text-sm group">
                    <Folder className="w-4 h-4 text-zinc-500 group-hover:text-qz-accent transition-colors shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </Link>
                ))
              )}
            </nav>
            <Link href="/library" className="flex items-center gap-2 px-3 py-2 mt-2 text-sm text-qz-accent hover:text-indigo-300 font-medium w-full text-left">
              <Plus className="w-4 h-4" /> New Folder
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
