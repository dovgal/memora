import { NextResponse, NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session: any = await getServerSession(authOptions)

    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        const response = await fetch(`${rustApiUrl}/api/sets/${id}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${session.id_token}`
            },
        })

        if (!response.ok) {
            let errorText = "Failed to fetch set";
            try {
                const data = await response.json();
                errorText = data.error || errorText;
            } catch (e) { }
            return NextResponse.json({ error: errorText }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        console.error("Error fetching set from backend:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session: any = await getServerSession(authOptions)

    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()

        if (!body.fieldsSchema || body.fieldsSchema.length === 0) {
            return NextResponse.json({ error: "DEBUG: fieldsSchema is missing or empty array!" }, { status: 400 });
        }

        console.log("DEBUG: Next.js API received payload for UpdateSet:", JSON.stringify(body, null, 2))
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        const response = await fetch(`${rustApiUrl}/api/sets/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.id_token}`
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            let errorText = "Failed to update set";
            try {
                const data = await response.json();
                errorText = data.error || errorText;
            } catch (e) {
                // Ignore parsing errors
            }
            return NextResponse.json(
                { error: errorText },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data, { status: 200 })
    } catch (error) {
        console.error("Error pushing set update to backend:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session: any = await getServerSession(authOptions)

    if (!session || !session.id_token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

        const response = await fetch(`${rustApiUrl}/api/sets/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${session.id_token}`
            },
        })

        if (!response.ok) {
            let errorText = "Failed to delete set";
            try {
                const data = await response.json();
                errorText = data.error || errorText;
            } catch (e) { }
            return NextResponse.json({ error: errorText }, { status: response.status })
        }

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
        console.error("Error deleting set from backend:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
