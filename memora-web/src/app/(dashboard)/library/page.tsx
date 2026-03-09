import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { SetSummaryResponse, FolderSummaryResponse } from "@/types/schema";
import LibraryClient from "./LibraryClient";
import { redirect } from "next/navigation";

async function getUserSets(token: string): Promise<SetSummaryResponse[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    try {
        const res = await fetch(`${apiUrl}/api/sets`, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: 'no-store'
        });
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

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

export default async function LibraryPage() {
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.id_token) {
        redirect("/login");
    }

    const [sets, folders] = await Promise.all([
        getUserSets(session.id_token),
        getUserFolders(session.id_token)
    ]);

    return (
        <LibraryClient
            initialSets={sets}
            initialFolders={folders}
            token={session.id_token}
        />
    );
}
