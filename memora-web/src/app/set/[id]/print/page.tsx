import { notFound } from "next/navigation"
import { SetResponse } from "@/types/schema"
import PrintSetLayout from "./PrintSetLayout"

async function getSet(id: string): Promise<SetResponse | null> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

    try {
        const res = await fetch(`${apiUrl}/api/sets/${id}`, {
            next: { revalidate: 60 }
        })

        if (!res.ok) {
            return null
        }
        return await res.json()
    } catch (error) {
        console.error("Error fetching set for print:", error)
        return null
    }
}

export default async function PrintSetPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const set = await getSet(id)

    if (!set) {
        notFound()
    }

    return <PrintSetLayout set={set} />
}
