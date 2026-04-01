import { NextRequest, NextResponse } from "next/server";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; field: string }> }
) {
    const { id, field } = await params;
    const rustApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

    try {
        const response = await fetch(`${rustApiUrl}/api/audio/${id}/${field}`, {
            method: "GET",
            // No auth required for audio as they are public resources linked to public sets
            cache: 'force-cache', // Optimization: cache audio in Next.js as well
        });

        if (!response.ok) {
            return new NextResponse("Audio not found", { status: response.status });
        }

        const audioData = await response.arrayBuffer();
        
        return new NextResponse(audioData, {
            status: 200,
            headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("Error fetching audio from backend:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
