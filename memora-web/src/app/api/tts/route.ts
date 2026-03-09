import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { text, voiceId } = await req.json();

        if (!text || !voiceId) {
            return NextResponse.json({ error: "Missing text or voiceId" }, { status: 400 });
        }

        const response = await fetch("https://api.inworld.ai/tts/v1/voice", {
            method: "POST",
            headers: {
                // The user provided this exact hardcoded key in the curl example.
                // Normally this would be in process.env, but we're embedding it directly per their request payload.
                "Authorization": "Basic SDFtYWl4VHFNVm9xclZhcUw0enB2TnhoYlhmRDJlU3k6VHRSa05maWZhS1lvUEtkWWp3Tk43RG5keldtVDlNc1k1Y2hJZlVUYUFLcXRCNzdmR0FRUzFPNFFZUFphdFJ3NQ==",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: text,
                voiceId: voiceId,
                modelId: "inworld-tts-1.5-max",
                timestampType: "WORD"
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Inworld API Error:", errorText);
            return NextResponse.json({ error: "Inworld API request failed" }, { status: response.status });
        }

        const data = await response.json();
        const base64Audio = data.audioContent;

        if (!base64Audio) {
            return NextResponse.json({ error: "No audio content returned" }, { status: 500 });
        }

        return NextResponse.json({ audioContent: base64Audio });
    } catch (error) {
        console.error("TTS Route Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
