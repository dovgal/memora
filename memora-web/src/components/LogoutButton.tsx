'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function LogoutButton() {
    return (
        <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-qz-bg border border-qz-border-light hover:bg-qz-card text-qz-text-muted hover:text-qz-text transition-colors text-sm font-medium"
        >
            <LogOut className="w-4 h-4" />
            Log Out
        </button>
    );
}
