import { NextResponse, NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function POST(req: NextRequest) {
    const token = await getToken({ req })

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        const response = await fetch(`${rustApiUrl}/api/sets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token.id_token}` // Using id_token string from NextAuth
            },
            body: JSON.stringify(body),
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { error: data.error || "Failed to create set" },
                { status: response.status }
            )
        }

        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        console.error("Error pushing set to backend:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
