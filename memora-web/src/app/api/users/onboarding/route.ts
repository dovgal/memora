import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function POST(req: NextRequest) {
    try {
        // 1. Get raw JWT token from the Next.js request cookies
        const rawToken = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET as string,
            raw: true // Essential: we need the encoded string to pass to Rust, not the decoded object
        })

        if (!rawToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. Parse the client's payload (Date of Birth)
        const body = await req.json()

        // 3. Proxy the request to the Rust backend, injecting the Bearer token
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

        const backendRes = await fetch(`${rustApiUrl}/api/users/onboarding`, {
            method: "POST",
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
