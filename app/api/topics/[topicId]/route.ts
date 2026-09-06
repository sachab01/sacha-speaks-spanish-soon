import { NextResponse } from "next/server";

import { getTopicWithBank } from "@/lib/db/topics";

export async function GET(_request: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const id = Number(topicId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
  }

  const result = await getTopicWithBank(id);
  if (!result) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
