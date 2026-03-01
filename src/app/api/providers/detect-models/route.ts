import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api");

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json(
      { models: [], error: "Missing endpoint query param" },
      { status: 400 },
    );
  }

  const base = endpoint.replace(/\/+$/, "");
  log.debug("Detect models", { endpoint: base });

  try {
    const res = await fetch(`${base}/models`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({
        models: [],
        error: `Sidecar returned ${res.status}`,
      });
    }

    const data = (await res.json()) as { models?: string[] };
    const models = data.models ?? [];
    log.debug("Models detected", { count: models.length });
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({
      models: [],
      error: "Could not reach sidecar — is it running?",
    });
  }
}
