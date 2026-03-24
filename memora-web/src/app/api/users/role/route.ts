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

        let data;
        try {
            data = await backendRes.json();
        } catch (e) {
            try { data = { error: await backendRes.text() || "Failed to update role" }; } catch (_) { data = { error: "Failed to update role" }; }
        }

        if (!backendRes.ok) {
            return NextResponse.json(
                { error: data.error || "Failed to update role" },
                { status: backendRes.status }
            )
        }

        return NextResponse.json(data, { status: 200 })

    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}
