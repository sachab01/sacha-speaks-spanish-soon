import { NextResponse } from "next/server";
import { z } from "zod";

import { createTopic, listTopics } from "@/lib/db/topics";

const CreateTopicSchema = z.object({
  name: z.string().trim().min(1, "Topic name is required").max(200, "Topic name is too long"),
  instructions: z.string().trim().max(1000, "Instructions are too long").optional(),
});

export async function GET() {
  const topics = await listTopics();
  return NextResponse.json({ topics });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const result = await createTopic(parsed.data.name, parsed.data.instructions || undefined);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create topic:", error);
    return NextResponse.json({ error: "Failed to create the topic. Please try again." }, { status: 500 });
  }
}
