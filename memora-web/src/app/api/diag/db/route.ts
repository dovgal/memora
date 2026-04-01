import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

    try {
        console.log("DEBUG: Proxying /api/diag/db to:", rustApiUrl);
        const response = await fetch(`${rustApiUrl}/api/diag/db`, {
            method: "GET",
            cache: 'no-store',
        });

        const text = await response.text();
        
        return new NextResponse(text, {
            status: response.status,
            headers: {
                "Content-Type": "text/plain",
            },
        });
    } catch (error: any) {
        console.error("Error fetching diagnostics from backend:", error);
        return new NextResponse(`Error reaching backend: ${error.message}\nURL: ${rustApiUrl}`, { status: 500 });
    }
}
