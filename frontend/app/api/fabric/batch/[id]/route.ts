import { NextResponse } from "next/server";

const FABRIC_BACKEND_URL =
  process.env.FABRIC_BACKEND_URL || "http://10.194.253.204:5000";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!/^[A-Za-z0-9_-]{3,30}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid batch ID." },
        { status: 400 }
      );
    }

    const upstreamUrl = new URL(
      `/api/batch/${encodeURIComponent(id)}`,
      FABRIC_BACKEND_URL
    );

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Fabric batch proxy request failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not reach the Fabric backend.",
      },
      { status: 502 }
    );
  }
}

