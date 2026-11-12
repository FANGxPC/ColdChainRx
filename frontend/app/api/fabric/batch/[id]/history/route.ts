import { NextResponse } from "next/server";
import path from "node:path";
import dotenv from "dotenv";

if (!process.env.FABRIC_BACKEND_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const rawFabricUrl =
  process.env.FABRIC_BACKEND_URL || "http://10.194.253.204:5000";
const FABRIC_BACKEND_URL = rawFabricUrl.replace(/\/+$/, "");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  let batchId = "BATCH001";
  try {
    const { id } = await context.params;
    batchId = id;

    if (!/^[A-Za-z0-9_-]{3,50}$/.test(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid batch ID." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || searchParams.get("limit") || "50";

    const upstreamUrl = new URL(
      `/api/batch/${encodeURIComponent(id)}/history?page=${page}&pageSize=${pageSize}`,
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
    console.warn("Fabric batch history proxy request failed, returning mock:", error);

    return NextResponse.json({
      success: true,
      data: [
        {
          txId: "b6a82a7f51953ce02672fa69c5305ce7b5454d6a13f6797a7e8b67eb637a77b8",
          timestamp: new Date().toISOString(),
          isDelete: false,
          record: {
            id: batchId,
            batchId: batchId,
            drugName: "Covishield Vaccine",
            manufacturer: "Serum Institute of India",
            currentOwner: "Manufacturer",
            status: "IN_TRANSIT",
            minTemp: 2.0,
            maxTemp: 8.0,
            excursionAlert: false,
            assignedDevice: "ESP32_BOX_01",
            deviceId: "ESP32_BOX_01"
          }
        }
      ],
      pagination: {
        totalRecords: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        hasMore: false
      },
      _mock: true
    });
  }
}
