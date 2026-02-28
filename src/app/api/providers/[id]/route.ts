import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const removed = store.remove(id);
  if (!removed) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
