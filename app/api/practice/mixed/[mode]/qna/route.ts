import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-utils";
import { askQuestionMixed } from "@/lib/db/qna";
import { parseQnaFormData } from "@/lib/qna-request";

export async function POST(request: Request) {
  const parsed = await parseQnaFormData(request);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const result = await askQuestionMixed(parsed);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
