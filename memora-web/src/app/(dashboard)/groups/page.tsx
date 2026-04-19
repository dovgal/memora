import React from 'react';
import { Users } from 'lucide-react';

export default function GroupsPage() {
    return (
        <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-24 h-24 bg-green-500/10 text-green-400 rounded-3xl flex items-center justify-center mb-8">
                <Users size={48} />
            </div>
            <h1 className="text-4xl font-bold mb-4">Study Groups</h1>
            <p className="text-xl text-qz-text-muted max-w-lg mb-8">
                This feature is currently under development. Soon, you'll be able to create study groups, share flashcard sets, and study collaboratively with your classmates.
            </p>
            <div className="inline-block bg-qz-bg border border-qz-border-light text-qz-text-muted px-6 py-3 rounded-full font-medium">
                Coming Soon 👋
            </div>
        </div>
    );
}
