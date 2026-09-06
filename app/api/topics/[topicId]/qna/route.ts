import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-utils";
import { askQuestion } from "@/lib/db/qna";
import { parseQnaFormData } from "@/lib/qna-request";

export async function POST(request: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
  }

  const parsed = await parseQnaFormData(request);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const result = await askQuestion({ topicId, ...parsed });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
