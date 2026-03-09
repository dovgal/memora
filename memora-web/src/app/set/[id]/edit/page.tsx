import { notFound } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import EditSetForm from "./EditSetForm"
import { SetResponse } from "@/types/schema"

async function getSet(id: string, token: string): Promise<SetResponse | null> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

    try {
        const res = await fetch(`${apiUrl}/api/sets/${id}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            },
            next: { revalidate: 0 } // no cache for editing
        })

        if (!res.ok) {
            return null
        }
        return await res.json()
    } catch (error) {
        console.error("Error fetching set:", error)
        return null
    }
}

export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session: any = await getServerSession(authOptions as any)

    if (!session || !session.id_token) {
        return <div className="p-12 text-center text-white">Вы должны войти в систему.</div>
    }

    const set = await getSet(id, session.id_token)

    if (!set) {
        notFound()
    }

    // Pass the fetched set data down to the client form component
    return <EditSetForm initialSet={set} setId={id} token={session.id_token} />
}
