import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { RegisterProviderRequest } from "@/lib/types";

export async function GET(request: NextRequest) {
  const model = request.nextUrl.searchParams.get("model") ?? undefined;
  return NextResponse.json(store.getAll(model));
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RegisterProviderRequest;

  if (!body.name || !body.model || !body.endpoint || !body.pricing || !body.walletAddress) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    new URL(body.endpoint);
  } catch {
    return NextResponse.json({ error: "Invalid endpoint URL" }, { status: 400 });
  }

  const provider = store.add(body);
  return NextResponse.json(provider, { status: 201 });
}
