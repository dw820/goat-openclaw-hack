import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createLogger } from "@/lib/logger";
import type { RegisterProviderRequest } from "@/lib/types";

const log = createLogger("api");

export async function GET(request: NextRequest) {
  const model = request.nextUrl.searchParams.get("model") ?? undefined;
  log.debug("GET /providers", { modelFilter: model });
  return NextResponse.json(await store.getAll(model));
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RegisterProviderRequest;

  if (!body.name || !body.endpoint || !body.pricing || !body.walletAddress) {
    log.warn("Registration rejected: missing fields");
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Strip trailing slash(es) before storing
  body.endpoint = body.endpoint.replace(/\/+$/, "");

  try {
    new URL(body.endpoint);
  } catch {
    log.warn("Registration rejected: invalid URL", { endpoint: body.endpoint });
    return NextResponse.json({ error: "Invalid endpoint URL" }, { status: 400 });
  }

  // Auto-detect available models from the sidecar
  let models: string[] | undefined;
  try {
    log.debug("Detecting models", { endpoint: body.endpoint });
    const res = await fetch(`${body.endpoint}/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as { models?: string[] };
      if (data.models && data.models.length > 0) {
        models = data.models;
        log.info("Models detected", { models });
      }
    }
  } catch {
    log.info("Model detection failed, using declared");
  }
  if (!models) {
    if (body.model) {
      models = [body.model];
    } else {
      log.warn("No models detected or provided");
      return NextResponse.json(
        { error: "No models could be detected and none were provided" },
        { status: 400 },
      );
    }
  }

  // Derive model from first detected model if not provided
  if (!body.model) {
    body.model = models[0];
  }

  const provider = await store.add(body, models);
  log.info("Provider registered", { id: provider.id, name: provider.name, models });
  return NextResponse.json(provider, { status: 201 });
}
