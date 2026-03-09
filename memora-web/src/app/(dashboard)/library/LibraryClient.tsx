"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { Layers, Folder, Plus, X } from 'lucide-react';
import { SetSummaryResponse, FolderSummaryResponse } from '@/types/schema';
import { useRouter } from 'next/navigation';

interface LibraryClientProps {
    initialSets: SetSummaryResponse[];
    initialFolders: FolderSummaryResponse[];
    token: string;
}

export default function LibraryClient({ initialSets, initialFolders, token }: LibraryClientProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'sets' | 'folders'>('sets');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [folderName, setFolderName] = useState('');
    const [folderDesc, setFolderDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderName.trim()) return;

        setIsCreating(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
            const res = await fetch(`${apiUrl}/api/folders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: folderName,
                    description: folderDesc || null
                })
            });

            if (res.ok) {
                setIsCreateModalOpen(false);
                setFolderName('');
                setFolderDesc('');
                setActiveTab('folders');
                router.refresh(); // Refresh Server Components to get new data
            } else {
                console.error("Failed to create folder");
            }
        } catch (error) {
            console.error("Error creating folder", error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <h1 className="text-3xl font-bold">Your Library</h1>

                {activeTab === 'folders' && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                    >
                        <Plus size={18} /> New Folder
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-zinc-800 mb-8">
                <button
                    onClick={() => setActiveTab('sets')}
                    className={`pb-4 px-2 font-medium transition-colors border-b-2 ${activeTab === 'sets' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-300'}`}
                >
                    Study Sets
                </button>
                <button
                    onClick={() => setActiveTab('folders')}
                    className={`pb-4 px-2 font-medium transition-colors border-b-2 ${activeTab === 'folders' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-300'}`}
                >
                    Folders
                </button>
            </div>

            {/* Tab Content: Sets */}
            {activeTab === 'sets' && (
                <div>
                    {initialSets.length === 0 ? (
                        <div className="bg-[#1f1f3d]/50 border border-[#2a2a4d] rounded-2xl p-8 text-center mt-12">
                            <Layers className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
                            <p className="text-zinc-400 mb-4">You have not created any sets yet.</p>
                            <Link href="/dashboard/import" className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                                Create a Set
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {initialSets.map(set => (
                                <Link href={`/set/${set.id}`} key={set.id} className="block p-6 rounded-2xl bg-[#1f1f3d] border border-[#2a2a4d] hover:border-indigo-500/50 transition-all group group/card">
                                    <h3 className="text-lg font-bold text-white mb-2 group-hover/card:text-indigo-300 transition-colors line-clamp-1">{set.title}</h3>
                                    {set.description && <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{set.description}</p>}
                                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-auto">
                                        <Layers className="w-4 h-4" /> {set.flashcardCount} Terms
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab Content: Folders */}
            {activeTab === 'folders' && (
                <div>
                    {initialFolders.length === 0 ? (
                        <div className="bg-[#1f1f3d]/50 border border-[#2a2a4d] rounded-2xl p-8 text-center mt-12">
                            <Folder className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
                            <p className="text-zinc-400 mb-4">Organize your study sets into folders.</p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                            >
                                Create your first folder
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {initialFolders.map(folder => (
                                <Link href={`/folder/${folder.id}`} key={folder.id} className="block p-6 flex flex-col items-center justify-center text-center rounded-2xl bg-[#1f1f3d] border border-[#2a2a4d] hover:border-indigo-500/50 transition-all group group/card min-h-[160px]">
                                    <Folder className="w-10 h-10 text-zinc-400 group-hover/card:text-indigo-400 mb-3 transition-colors" />
                                    <h3 className="text-lg font-bold text-white mb-1 group-hover/card:text-indigo-300 transition-colors line-clamp-1">{folder.name}</h3>
                                    <p className="text-zinc-500 text-sm">{folder.setCount} sets</p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Create Folder Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1f1f3d] border border-[#2a2a4d] rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Create a new folder</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateFolder}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Folder title</label>
                                <input
                                    type="text"
                                    required
                                    value={folderName}
                                    onChange={e => setFolderName(e.target.value)}
                                    placeholder="Enter a title"
                                    className="w-full bg-black/50 border border-[#2a2a4d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Description (optional)</label>
                                <input
                                    type="text"
                                    value={folderDesc}
                                    onChange={e => setFolderDesc(e.target.value)}
                                    placeholder="Enter a description"
                                    className="w-full bg-black/50 border border-[#2a2a4d] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={!folderName.trim() || isCreating}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center shadow-lg"
                            >
                                {isCreating ? 'Creating...' : 'Create folder'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
