import { NextResponse, NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
    const session: any = await getServerSession(authOptions)

    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()

        if (!body.fieldsSchema || body.fieldsSchema.length === 0) {
            return NextResponse.json({ error: "DEBUG: fieldsSchema is missing or empty array!" }, { status: 400 });
        }

        console.log("DEBUG: Next.js API creating set...")
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        // Clean up debug output and use session.id_token
        const response = await fetch(`${rustApiUrl}/api/sets`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.id_token}`
            },
            body: JSON.stringify(body),
        })

        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { error: await response.text() || "Failed to create set" };
        }

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

export async function GET(req: NextRequest) {
    const session: any = await getServerSession(authOptions)

    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        const response = await fetch(`${rustApiUrl}/api/sets`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${session.id_token}`
            },
        })

        if (!response.ok) {
            let errorText = "Failed to fetch sets";
            try {
                const data = await response.json();
                errorText = data.error || errorText;
            } catch (e) {
                try { errorText = await response.text() || errorText; } catch (_) {}
            }
            return NextResponse.json(
                { error: errorText },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        console.error("Error fetching sets:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
