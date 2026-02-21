import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function PATCH(req: NextRequest) {
    try {
        const rawToken = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET as string,
            raw: true
        })

        if (!rawToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

        const backendRes = await fetch(`${rustApiUrl}/api/users/role`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${rawToken}`
            },
            body: JSON.stringify(body)
        })

        if (!backendRes.ok) {
            const errorText = await backendRes.text()
            return NextResponse.json(
                { error: `Backend failed: ${errorText}` },
                { status: backendRes.status }
            )
        }

        const data = await backendRes.json()
        return NextResponse.json(data, { status: 200 })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
