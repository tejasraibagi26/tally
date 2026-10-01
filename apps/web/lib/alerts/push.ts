import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Sends one message to every device the user has registered (Expo Push
 * Service, ALERTS.md §5.1). Returns how many tickets came back ok. Tokens
 * Expo reports as DeviceNotRegistered are deleted right away; receipt
 * polling for late failures can come later.
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  const tokens = await db.select({ token: schema.pushTokens.token }).from(schema.pushTokens).where(eq(schema.pushTokens.userId, userId));
  if (tokens.length === 0) return 0;

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(
      tokens.map((t) => ({ to: t.token, title: msg.title, body: msg.body, data: msg.data, sound: "default", channelId: "alerts" })),
    ),
  });
  if (!res.ok) throw new Error(`Expo push failed (${res.status}): ${await res.text().catch(() => "")}`);

  const json = (await res.json()) as { data?: { status: "ok" | "error"; details?: { error?: string } }[] };
  const tickets = json.data ?? [];
  const dead = tickets.flatMap((t, i) => (t.status === "error" && t.details?.error === "DeviceNotRegistered" ? [tokens[i]!.token] : []));
  if (dead.length > 0) await db.delete(schema.pushTokens).where(inArray(schema.pushTokens.token, dead));
  return tickets.filter((t) => t.status === "ok").length;
}
