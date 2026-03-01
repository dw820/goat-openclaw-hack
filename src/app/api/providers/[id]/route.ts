import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createLogger } from "@/lib/logger";

const log = createLogger("api");

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  log.info("DELETE /providers", { id });
  const removed = await store.remove(id);
  if (!removed) {
    log.warn("Provider not found", { id });
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }
  log.info("Provider removed", { id });
  return new NextResponse(null, { status: 204 });
}
