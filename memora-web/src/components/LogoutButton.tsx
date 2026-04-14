'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function LogoutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a092d] border border-[#2e3856] hover:bg-[#2e3856] text-zinc-300 hover:text-white transition-colors text-sm font-medium"
        >
            <LogOut className="w-4 h-4" />
            Log Out
        </button>
    );
}
