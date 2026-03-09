import { NextResponse, NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session: any = await getServerSession(authOptions)

    // params needs to be awaited in Next.js 15
    const params = await context.params;

    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        const response = await fetch(`${rustApiUrl}/api/sets/${params.id}/progress`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.id_token}`
            }
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error || "Failed to fetch study progress" },
                { status: response.status }
            )
        }

        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        console.error("Error fetching study progress from backend:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
