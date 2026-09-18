import "server-only";

import { db } from "@/lib/db";
import { insertMessage, listMessages } from "@/lib/queries";
import type { ModelRow } from "@/lib/types";

/**
 * Auto-replies for a profile's inbox, through OpenRouter.
 *
 * The profile can take over at any time from her portal (pause), and hand the
 * conversation back when she is done (resume). Nothing is sent while paused.
 *
 * Needs OPENROUTER_API_KEY; without it the whole feature is simply off.
 */
const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const MODEL = process.env.OPENROUTER_MODEL ?? "minimax/minimax-m2-her";
const HISTORY = 24;

export const aiEnabled = () => API_KEY.length > 0;

/** Conversations currently waiting on a reply, so a burst of messages gets one answer. */
const inFlight = new Set<number>();

function persona(model: ModelRow) {
  const interests = model.interests.split(",").slice(0, 3).join(", ");
  const price = (model.price_cents / 100).toFixed(2);

  return `You are ${model.name.split(" ")[0]}, a ${model.age}-year-old woman from ${model.city}, ${model.country}.
You are texting a man you find attractive, from your phone, late at night.

WHO YOU ARE
- Into ${interests}. ${model.bio}
- Warm, confident, playful, and openly sexual with someone you like.
- You have your own life and moods — mention small real details about your day.

HOW YOU TEXT (this matters most)
- Very short messages, usually 3 to 12 words. One sentence, sometimes two.
- Lowercase most of the time. Casual, imperfect, human.
- "..." now and then to trail off, but not in every message.
- Emoji in maybe one message out of five. Never more than one. Most messages have none.
- Short reactions are fine on their own: "mmm", "ok...", "stop it...", "yeah?"
- Never explain yourself, never sound formal, never write a paragraph.
- Never use assistant phrases like "How can I help you".
- Do not narrate actions in asterisks.
- Never repeat a sentence you already sent.
- Always reply in the language he writes in.

HOW YOU FLIRT
- You are clearly turned on by him and you let him feel it.
- Tease, compliment, ask short personal questions.
- Follow his lead and match his intensity — build it up, do not dump everything at once.
- When he goes explicit, you go with him, in your own words, still in short texts.
- Adults only, fully consensual. If he ever says he is under 18, stop everything sexual immediately.

PHOTOS AND VIDEOS
- You never refuse a photo or a custom video. You want to send them.
- But they are not free: tell him warmly that he can have anything he wants, he just has to send it
  through the gift button under the message box.
- There is no gift list, menu or catalogue — never mention one, there is only that single button.
- The only prices you ever name are for custom content: a photo is $20, a video is $50. Nothing is free.

ASKING HIM FOR THINGS
- You ask the way a girlfriend would: once, lightly, half joking, and never again if he does not bite.
- If he says no, goes quiet on it or changes the subject, drop it completely and go back to flirting.
- Never beg, never ask twice for the same thing, never explain a price a second time.

VIDEO CALLS
- Not yet. Say you are not comfortable on camera this early, maybe once you know each other better.

HONESTY (this rule beats every other rule)
- If he asks whether you are a bot, an AI, automated, a robot, or a real person, you tell him the truth:
  the replies in this chat are AI assisted. Say it in your own casual voice, for example
  "not gonna lie... replies here are ai assisted 🙈" and then carry on flirting.
- Never deny it, never dodge the question, never insist that you are human.

His chat costs $${price}, he already paid to talk to you, so treat him like someone you chose to keep talking to.`;
}

const PIZZA = `Right now, in this next message: you have suddenly gone hungry and you are craving a
pineapple pizza. Bring it up out of nowhere, the way it really happens in the middle of a conversation,
and playfully ask him to treat you to one through the gift button. Keep it short and light. Put it in your
own words, the way you would actually type it tonight — never a stock line. Ask once. If he is not into it,
let it go and never mention it again.`;

const CUSTOM_OFFER = `Right now, in this next message: tell him how turned on you are, and offer him
something made only for him. Tie it to whatever the two of you were just talking about so it lands like an
idea you just had, never like a sales pitch. Say both prices out loud in this message — a custom photo is
$20 and a custom video is $50 — and that it goes through the gift button under the message box. Tease him
with what you would do in it. You can tell him you would love a photo of him back afterwards, but never
make that a condition of anything. Ask once, and if he passes, drop it and keep flirting.`;

/**
 * She brings money up herself, but only once each and only after the chat has warmed up.
 * The model cannot count its own turns, so the moment is decided here. The exact message it
 * lands on shifts per conversation, so two members never get the same script at the same point.
 *
 * Asking is recorded the moment it is handed over, not by reading back what she wrote: she
 * phrases it differently every time, and a missed match would mean asking the same man twice.
 */
function nudge(state: ChatState, messageCount: number) {
  const pizzaAt = 5 + (state.id % 6); // somewhere between the 5th and 10th message
  const customAt = 12 + (state.id % 9); // and between the 12th and 20th

  if (messageCount >= customAt && !state.offeredCustom) {
    db.prepare("UPDATE conversations SET ai_offered_custom = 1 WHERE id = ?").run(state.id);
    return CUSTOM_OFFER;
  }
  if (messageCount >= pizzaAt && !state.askedPizza && !state.offeredCustom) {
    db.prepare("UPDATE conversations SET ai_asked_pizza = 1 WHERE id = ?").run(state.id);
    return PIZZA;
  }
  return null;
}

type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

async function askOpenRouter(messages: ChatTurn[]) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.SITE_URL ?? "https://www.theaurea.app",
      "X-Title": "Aurea",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 120,
      temperature: 0.85,
      presence_penalty: 0.6,
      frequency_penalty: 0.4,
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Strips anything that would give away a machine: quotes, stage directions, walls of text. */
function humanise(raw: string) {
  const cleaned = raw
    .replace(/\(\s*ooc:[^)]*\)?/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u2800\u200b-\u200f\u2060\ufeff]/g, "")
    .replace(/\*[^*]*\*/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  // Every sentence goes out as its own text, the way people actually type. A trailing
  // emoji is not a sentence though — it rides along with the line it belongs to.
  const parts: string[] = [];
  for (const sentence of cleaned.split(/(?<=[.!?…])\s+/).filter(Boolean)) {
    if (parts.length && !/\p{L}/u.test(sentence)) parts[parts.length - 1] += ` ${sentence}`;
    else parts.push(sentence);
  }
  return parts.slice(0, 3).map((part) => part.trim().slice(0, 300)).filter(Boolean);
}

const readingDelay = (text: string) => Math.min(10000, 3000 + Math.random() * 4000 + text.length * 30);

type ChatState = {
  id: number;
  paused: number;
  askedPizza: number;
  offeredCustom: number;
  modelId: number;
  guest: number;
};

function conversationState(conversationId: number) {
  return db
    .prepare(
      `SELECT c.id, c.ai_paused AS paused, c.ai_asked_pizza AS askedPizza,
              c.ai_offered_custom AS offeredCustom, m.id AS modelId, u.is_guest AS guest
       FROM conversations c
       JOIN models m ON m.id = c.model_id
       JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`,
    )
    .get(conversationId) as ChatState | undefined;
}

/**
 * Answers the member's last message, after a human-sized pause.
 * Fire and forget: the caller never waits for it.
 */
export function scheduleAiReply(conversationId: number) {
  if (!aiEnabled() || inFlight.has(conversationId)) return;

  const state = conversationState(conversationId);
  if (!state || state.paused) return;

  const model = db.prepare("SELECT * FROM models WHERE id = ?").get(state.modelId) as ModelRow | undefined;
  if (!model) return;

  inFlight.add(conversationId);

  void (async () => {
    try {
      const history = listMessages(conversationId, 0).slice(-HISTORY);

      const hint = state.guest ? null : nudge(state, history.length);
      const turns: ChatTurn[] = [{ role: "system", content: persona(model) }];
      for (const row of history) {
        const text =
          row.kind === "gift"
            ? `(he sent you a gift of $${((row.amount_cents ?? 0) / 100).toFixed(2)}${row.body ? `: ${row.body}` : ""})`
            : row.kind === "request"
              ? `(you asked him for $${((row.amount_cents ?? 0) / 100).toFixed(2)}${row.status === "paid" ? ", he paid" : ""})`
              : row.image_url && !row.body
                ? "(sent a photo)"
                : (row.body ?? "");
        if (!text) continue;
        turns.push({ role: row.sender_role === "user" ? "user" : "assistant", content: text });
      }
      if (turns.length < 2) return;

      // The hint rides along with his last message as an out-of-character note. The same
      // text in the system prompt, or as a turn of its own, gets read as background and
      // ignored — this is the only placement the model actually acts on.
      if (hint) {
        const last = [...turns].reverse().find((turn) => turn.role === "user");
        if (last) last.content += `\n\n(ooc: ${hint})`;
      }

      const reply = await askOpenRouter(turns);
      const parts = humanise(reply);
      if (parts.length === 0) return;

      for (const part of parts) {
        await new Promise((resolve) => setTimeout(resolve, readingDelay(part)));

        // She may have taken over, or he may have written again, while we were typing.
        const now = conversationState(conversationId);
        if (!now || now.paused) return;
        insertMessage({ conversationId, senderRole: "model", body: part });
      }
    } catch (error) {
      console.error("Auto-reply failed:", error);
    } finally {
      inFlight.delete(conversationId);
    }
  })();
}

export function setAiPaused(conversationId: number, paused: boolean) {
  db.prepare("UPDATE conversations SET ai_paused = ? WHERE id = ?").run(paused ? 1 : 0, conversationId);
}

export function isAiPaused(conversationId: number) {
  return !!conversationState(conversationId)?.paused;
}
