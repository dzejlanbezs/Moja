import "server-only";

import crypto from "node:crypto";

import { db } from "@/lib/db";
import type { CatalogModel, ModelDetail, ModelRow } from "@/lib/types";

export const PAGE_SIZE = 9;

type ModelWithCover = ModelRow & { cover: string | null; photo_count: number };

function toCatalogModel(row: ModelWithCover): CatalogModel {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    age: row.age,
    city: row.city,
    country: row.country,
    tagline: row.tagline,
    priceCents: row.price_cents,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    isOnline: !!row.is_online,
    isVerified: !!row.is_verified,
    accent: row.accent,
    cover: row.cover ?? "",
    photoCount: row.photo_count,
  };
}

export type CatalogSort = "featured" | "price-asc" | "price-desc" | "newest" | "rating";

export type CatalogQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: CatalogSort;
  onlineOnly?: boolean;
  maxPriceCents?: number;
};

const SORT_SQL: Record<CatalogSort, string> = {
  featured: "m.is_featured DESC, m.is_online DESC, m.rating DESC, m.id ASC",
  "price-asc": "m.price_cents ASC, m.id ASC",
  "price-desc": "m.price_cents DESC, m.id ASC",
  newest: "m.created_at DESC, m.id DESC",
  rating: "m.rating DESC, m.reviews_count DESC, m.id ASC",
};

export function listModels(query: CatalogQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, query.pageSize ?? PAGE_SIZE));
  const sort = SORT_SQL[query.sort ?? "featured"] ?? SORT_SQL.featured;

  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (query.search?.trim()) {
    where.push("(m.name LIKE :search OR m.city LIKE :search OR m.country LIKE :search OR m.tagline LIKE :search)");
    params.search = `%${query.search.trim()}%`;
  }
  if (query.onlineOnly) where.push("m.is_online = 1");
  if (query.maxPriceCents) {
    where.push("m.price_cents <= :maxPrice");
    params.maxPrice = query.maxPriceCents;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM models m ${whereSql}`).get(params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT m.*,
              (SELECT url FROM model_photos p WHERE p.model_id = m.id ORDER BY p.position LIMIT 1) AS cover,
              (SELECT COUNT(*) FROM model_photos p WHERE p.model_id = m.id) AS photo_count
       FROM models m
       ${whereSql}
       ORDER BY ${sort}
       LIMIT :limit OFFSET :offset`,
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as ModelWithCover[];

  return {
    items: rows.map(toCatalogModel),
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}

export function getModelBySlug(slug: string): ModelDetail | null {
  const row = db
    .prepare(
      `SELECT m.*,
              (SELECT url FROM model_photos p WHERE p.model_id = m.id ORDER BY p.position LIMIT 1) AS cover,
              (SELECT COUNT(*) FROM model_photos p WHERE p.model_id = m.id) AS photo_count
       FROM models m WHERE m.slug = ?`,
    )
    .get(slug) as ModelWithCover | undefined;
  if (!row) return null;
  const photos = db
    .prepare("SELECT url FROM model_photos WHERE model_id = ? ORDER BY position")
    .all(row.id) as { url: string }[];

  return {
    ...toCatalogModel(row),
    bio: row.bio,
    heightCm: row.height_cm,
    languages: row.languages.split(",").map((s) => s.trim()).filter(Boolean),
    interests: row.interests.split(",").map((s) => s.trim()).filter(Boolean),
    zodiac: row.zodiac,
    hair: row.hair,
    eyes: row.eyes,
    responseTime: row.response_time,
    photos: photos.map((p) => p.url),
  };
}

export function getModelById(id: number): ModelRow | undefined {
  return db.prepare("SELECT * FROM models WHERE id = ?").get(id) as ModelRow | undefined;
}

export function getModelByUserId(userId: number): ModelRow | undefined {
  return db.prepare("SELECT * FROM models WHERE user_id = ?").get(userId) as ModelRow | undefined;
}

export function similarModels(model: ModelDetail, limit = 3): CatalogModel[] {
  const rows = db
    .prepare(
      `SELECT m.*,
              (SELECT url FROM model_photos p WHERE p.model_id = m.id ORDER BY p.position LIMIT 1) AS cover,
              (SELECT COUNT(*) FROM model_photos p WHERE p.model_id = m.id) AS photo_count
       FROM models m
       WHERE m.id != ?
       ORDER BY ABS(m.price_cents - ?) ASC, m.rating DESC
       LIMIT ?`,
    )
    .all(model.id, model.priceCents, limit) as ModelWithCover[];
  return rows.map(toCatalogModel);
}

/* ----------------------------------- access ---------------------------------- */

export type ModelAccess = {
  status: "none" | "pending" | "unlocked";
  conversationId?: number;
  orderCode?: string;
};

export function getAccess(userId: number, modelId: number): ModelAccess {
  const conversation = db
    .prepare("SELECT id FROM conversations WHERE user_id = ? AND model_id = ?")
    .get(userId, modelId) as { id: number } | undefined;
  if (conversation) return { status: "unlocked", conversationId: conversation.id };

  const pending = db
    .prepare(
      "SELECT code FROM orders WHERE user_id = ? AND model_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
    )
    .get(userId, modelId) as { code: string } | undefined;
  if (pending) return { status: "pending", orderCode: pending.code };

  return { status: "none" };
}

/* ----------------------------------- orders ---------------------------------- */

export type OrderView = {
  id: number;
  code: string;
  amountCents: number;
  method: "card" | "balance";
  status: "pending" | "approved" | "rejected";
  cardBrand: string | null;
  cardLast4: string | null;
  cardName: string | null;
  createdAt: number;
  decidedAt: number | null;
  modelId: number;
  modelName: string;
  modelSlug: string;
  modelCover: string | null;
  userId: number;
  userName: string;
  userEmail: string;
  userBalanceCents: number;
};

const ORDER_SELECT = `
  SELECT o.id, o.code, o.amount_cents AS amountCents, o.method, o.status,
         o.card_brand AS cardBrand, o.card_last4 AS cardLast4, o.card_name AS cardName,
         o.created_at AS createdAt, o.decided_at AS decidedAt,
         m.id AS modelId, m.name AS modelName, m.slug AS modelSlug,
         (SELECT url FROM model_photos p WHERE p.model_id = m.id ORDER BY p.position LIMIT 1) AS modelCover,
         u.id AS userId, u.display_name AS userName, u.email AS userEmail, u.balance_cents AS userBalanceCents
  FROM orders o
  JOIN models m ON m.id = o.model_id
  JOIN users u ON u.id = o.user_id
`;

export function listOrders(filter: { status?: "pending" | "approved" | "rejected"; userId?: number } = {}) {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.status) {
    where.push("o.status = :status");
    params.status = filter.status;
  }
  if (filter.userId) {
    where.push("o.user_id = :userId");
    params.userId = filter.userId;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(`${ORDER_SELECT} ${whereSql} ORDER BY o.created_at DESC, o.id DESC`)
    .all(params) as OrderView[];
}

export function getOrder(id: number): OrderView | undefined {
  return db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id) as OrderView | undefined;
}

export class OrderError extends Error {}

export function createOrder(input: {
  userId: number;
  modelId: number;
  method: "card" | "balance";
  card?: { brand: string; last4: string; name: string };
}) {
  const model = getModelById(input.modelId);
  if (!model) throw new OrderError("Model not found");

  const access = getAccess(input.userId, input.modelId);
  if (access.status === "unlocked") throw new OrderError("You already have access to this chat");
  if (access.status === "pending") throw new OrderError("You already have a payment awaiting approval");

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(input.userId) as
    | { id: number; balance_cents: number }
    | undefined;
  if (!user) throw new OrderError("User not found");

  const code = `AUR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const now = Date.now();

  const run = db.transaction(() => {
    if (input.method === "balance") {
      if (user.balance_cents < model.price_cents) throw new OrderError("Not enough balance");
      db.prepare("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?").run(
        model.price_cents,
        user.id,
      );
      db.prepare(
        "INSERT INTO transactions (user_id, amount_cents, kind, note, created_at) VALUES (?, ?, 'purchase', ?, ?)",
      ).run(user.id, -model.price_cents, `Unlock chat with ${model.name}`, now);
    }

    const info = db
      .prepare(
        `INSERT INTO orders (code, user_id, model_id, amount_cents, method, status, card_brand, card_last4, card_name, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .run(
        code,
        user.id,
        model.id,
        model.price_cents,
        input.method,
        input.card?.brand ?? null,
        input.card?.last4 ?? null,
        input.card?.name ?? null,
        now,
      );
    return Number(info.lastInsertRowid);
  });

  const orderId = run();
  return { orderId, code };
}

export function approveOrder(orderId: number, adminId: number) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as
    | { id: number; user_id: number; model_id: number; status: string; amount_cents: number; method: string }
    | undefined;
  if (!order) throw new OrderError("Order not found");
  if (order.status !== "pending") throw new OrderError("Order already decided");

  const now = Date.now();
  const run = db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'approved', decided_at = ?, decided_by = ? WHERE id = ?").run(
      now,
      adminId,
      orderId,
    );
    const existing = db
      .prepare("SELECT id FROM conversations WHERE user_id = ? AND model_id = ?")
      .get(order.user_id, order.model_id) as { id: number } | undefined;
    if (existing) return existing.id;
    const info = db
      .prepare(
        "INSERT INTO conversations (user_id, model_id, order_id, created_at, last_message_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(order.user_id, order.model_id, order.id, now, now);
    return Number(info.lastInsertRowid);
  });

  return run();
}

export function rejectOrder(orderId: number, adminId: number) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as
    | { id: number; user_id: number; status: string; amount_cents: number; method: string; model_id: number }
    | undefined;
  if (!order) throw new OrderError("Order not found");
  if (order.status !== "pending") throw new OrderError("Order already decided");
  const model = getModelById(order.model_id);
  const now = Date.now();

  db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'rejected', decided_at = ?, decided_by = ? WHERE id = ?").run(
      now,
      adminId,
      orderId,
    );
    if (order.method === "balance") {
      db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").run(
        order.amount_cents,
        order.user_id,
      );
      db.prepare(
        "INSERT INTO transactions (user_id, amount_cents, kind, note, created_at) VALUES (?, ?, 'refund', ?, ?)",
      ).run(order.user_id, order.amount_cents, `Refund for ${model?.name ?? "chat unlock"}`, now);
    }
  })();
}

export function topUpBalance(userId: number, amountCents: number, note: string) {
  const now = Date.now();
  db.transaction(() => {
    db.prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?").run(amountCents, userId);
    db.prepare(
      "INSERT INTO transactions (user_id, amount_cents, kind, note, created_at) VALUES (?, ?, 'topup', ?, ?)",
    ).run(userId, amountCents, note, now);
  })();
}

/* -------------------------------- conversations ------------------------------- */

export type ConversationView = {
  id: number;
  modelId: number;
  modelName: string;
  modelSlug: string;
  modelCover: string | null;
  modelOnline: number;
  modelAccent: string;
  userId: number;
  userName: string;
  userEmail: string;
  lastMessageAt: number;
  lastBody: string | null;
  lastImage: string | null;
  lastSender: string | null;
  unreadForUser: number;
  unreadForModel: number;
};

const CONVERSATION_SELECT = `
  SELECT c.id, c.last_message_at AS lastMessageAt,
         m.id AS modelId, m.name AS modelName, m.slug AS modelSlug, m.is_online AS modelOnline, m.accent AS modelAccent,
         (SELECT url FROM model_photos p WHERE p.model_id = m.id ORDER BY p.position LIMIT 1) AS modelCover,
         u.id AS userId, u.display_name AS userName, u.email AS userEmail,
         (SELECT body FROM messages ms WHERE ms.conversation_id = c.id ORDER BY ms.id DESC LIMIT 1) AS lastBody,
         (SELECT image_url FROM messages ms WHERE ms.conversation_id = c.id ORDER BY ms.id DESC LIMIT 1) AS lastImage,
         (SELECT sender_role FROM messages ms WHERE ms.conversation_id = c.id ORDER BY ms.id DESC LIMIT 1) AS lastSender,
         (SELECT COUNT(*) FROM messages ms WHERE ms.conversation_id = c.id AND ms.sender_role = 'model' AND ms.read_by_user = 0) AS unreadForUser,
         (SELECT COUNT(*) FROM messages ms WHERE ms.conversation_id = c.id AND ms.sender_role = 'user' AND ms.read_by_model = 0) AS unreadForModel
  FROM conversations c
  JOIN models m ON m.id = c.model_id
  JOIN users u ON u.id = c.user_id
`;

export function listConversationsForUser(userId: number): ConversationView[] {
  return db
    .prepare(`${CONVERSATION_SELECT} WHERE c.user_id = ? ORDER BY c.last_message_at DESC`)
    .all(userId) as ConversationView[];
}

export function listConversationsForModel(modelId: number): ConversationView[] {
  return db
    .prepare(`${CONVERSATION_SELECT} WHERE c.model_id = ? ORDER BY c.last_message_at DESC`)
    .all(modelId) as ConversationView[];
}

export function getConversation(id: number): ConversationView | undefined {
  return db.prepare(`${CONVERSATION_SELECT} WHERE c.id = ?`).get(id) as ConversationView | undefined;
}

export type MessageRow = {
  id: number;
  conversation_id: number;
  sender_role: "user" | "model";
  body: string | null;
  image_url: string | null;
  created_at: number;
};

export function listMessages(conversationId: number, afterId = 0): MessageRow[] {
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id ASC")
    .all(conversationId, afterId) as MessageRow[];
}

export function insertMessage(input: {
  conversationId: number;
  senderRole: "user" | "model";
  body?: string | null;
  imageUrl?: string | null;
}) {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO messages (conversation_id, sender_role, body, image_url, created_at, read_by_user, read_by_model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.conversationId,
      input.senderRole,
      input.body ?? null,
      input.imageUrl ?? null,
      now,
      input.senderRole === "user" ? 1 : 0,
      input.senderRole === "model" ? 1 : 0,
    );
  db.prepare("UPDATE conversations SET last_message_at = ? WHERE id = ?").run(now, input.conversationId);
  return Number(info.lastInsertRowid);
}

export function markRead(conversationId: number, viewer: "user" | "model") {
  if (viewer === "user") {
    db.prepare("UPDATE messages SET read_by_user = 1 WHERE conversation_id = ? AND sender_role = 'model'").run(
      conversationId,
    );
  } else {
    db.prepare("UPDATE messages SET read_by_model = 1 WHERE conversation_id = ? AND sender_role = 'user'").run(
      conversationId,
    );
  }
}

export function unreadCountForUser(userId: number) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM messages ms
       JOIN conversations c ON c.id = ms.conversation_id
       WHERE c.user_id = ? AND ms.sender_role = 'model' AND ms.read_by_user = 0`,
    )
    .get(userId) as { count: number };
  return row.count;
}

export function unreadCountForModel(modelId: number) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count FROM messages ms
       JOIN conversations c ON c.id = ms.conversation_id
       WHERE c.model_id = ? AND ms.sender_role = 'user' AND ms.read_by_model = 0`,
    )
    .get(modelId) as { count: number };
  return row.count;
}

export function pendingOrdersCount() {
  return (db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'").get() as { count: number })
    .count;
}
