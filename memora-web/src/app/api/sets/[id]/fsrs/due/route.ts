import { NextResponse, NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(
    req: NextRequest,
    context: { params: { id: string } }
) {
    const session: any = await getServerSession(authOptions)

    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        const response = await fetch(`${rustApiUrl}/api/sets/${context.params.id}/fsrs/due`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${session.id_token}`
            }
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error || "Failed to fetch due cards" },
                { status: response.status }
            )
        }

        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        console.error("Error fetching due cards:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
