import fs from "node:fs";
import path from "node:path";

import bcrypt from "bcryptjs";

import { db } from "../src/lib/db";
import { PALETTES, renderPoster } from "./art";
import { SEED_MODELS } from "./models-data";

const PHOTO_DIR = path.join(process.cwd(), "public", "models");
const PHOTOS_PER_MODEL = 4;

const ADMIN = { email: "admin@aurea.chat", password: "Admin1234!", name: "Aurea Admin" };
const DEMO_USER = { email: "demo@aurea.chat", password: "demo1234", name: "Alex Morgan" };
const MODEL_PASSWORD = "model1234";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function upsertUser(input: {
  email: string;
  password: string;
  displayName: string;
  role: "user" | "model" | "admin";
  balanceCents?: number;
  avatarUrl?: string | null;
}) {
  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(input.email) as
    | { id: number }
    | undefined;
  if (existing) {
    db.prepare("UPDATE users SET display_name = ?, avatar_url = ?, role = ? WHERE id = ?").run(
      input.displayName,
      input.avatarUrl ?? null,
      input.role,
      existing.id,
    );
    return existing.id;
  }
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, role, balance_cents, avatar_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.email,
      bcrypt.hashSync(input.password, 10),
      input.displayName,
      input.role,
      input.balanceCents ?? 0,
      input.avatarUrl ?? null,
      Date.now(),
    );
  return Number(info.lastInsertRowid);
}

async function main() {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });

  const adminId = upsertUser({ ...ADMIN, displayName: ADMIN.name, role: "admin" });
  const demoUserId = upsertUser({
    ...DEMO_USER,
    displayName: DEMO_USER.name,
    role: "user",
    balanceCents: 25_000,
  });
  console.log(`admin #${adminId}, demo user #${demoUserId}`);

  const hasHistory = db
    .prepare("SELECT COUNT(*) AS count FROM transactions WHERE user_id = ?")
    .get(demoUserId) as { count: number };
  if (hasHistory.count === 0) {
    db.prepare(
      "INSERT INTO transactions (user_id, amount_cents, kind, note, created_at) VALUES (?, ?, 'topup', ?, ?)",
    ).run(demoUserId, 25_000, "Welcome balance added by admin", Date.now() - 90_000_000);
  }

  let created = 0;
  let renderedPhotos = 0;

  for (const [index, seed] of SEED_MODELS.entries()) {
    const slug = slugify(seed.name);
    const palette = PALETTES[index % PALETTES.length];
    const firstName = seed.name.split(" ")[0];
    const monogram = firstName[0].toUpperCase();

    const photoUrls: string[] = [];
    for (let variant = 0; variant < PHOTOS_PER_MODEL; variant += 1) {
      const file = `${slug}-${variant + 1}.webp`;
      const outFile = path.join(PHOTO_DIR, file);
      if (!fs.existsSync(outFile)) {
        await renderPoster({
          seed: slug,
          variant,
          palette,
          label: `${firstName} · ${seed.city}`,
          monogram,
          outFile,
        });
        renderedPhotos += 1;
      }
      photoUrls.push(`/models/${file}`);
    }

    const modelUserId = upsertUser({
      email: `${slugify(firstName)}@aurea.chat`,
      password: MODEL_PASSWORD,
      displayName: seed.name,
      role: "model",
      avatarUrl: photoUrls[0],
    });

    const existing = db.prepare("SELECT id FROM models WHERE slug = ?").get(slug) as { id: number } | undefined;
    const rating = Number((4.5 + ((index * 7) % 5) / 10).toFixed(1));
    const reviews = 40 + ((index * 37) % 260);
    const values = {
      user_id: modelUserId,
      slug,
      name: seed.name,
      age: seed.age,
      city: seed.city,
      country: seed.country,
      tagline: seed.tagline,
      bio: seed.bio,
      price_cents: Math.round(seed.price * 100),
      height_cm: seed.heightCm,
      languages: seed.languages.join(", "),
      interests: seed.interests.join(", "),
      zodiac: seed.zodiac,
      hair: seed.hair,
      eyes: seed.eyes,
      response_time: ["under 5 min", "under 15 min", "within the hour", "a few hours"][index % 4],
      rating,
      reviews_count: reviews,
      is_online: index % 3 === 0 ? 1 : 0,
      is_verified: 1,
      is_featured: index % 6 === 0 ? 1 : 0,
      accent: palette.accent,
      created_at: Date.now() - index * 3_600_000,
    };

    let modelId: number;
    if (existing) {
      modelId = existing.id;
      db.prepare(
        `UPDATE models SET user_id = @user_id, name = @name, age = @age, city = @city, country = @country,
           tagline = @tagline, bio = @bio, price_cents = @price_cents, height_cm = @height_cm,
           languages = @languages, interests = @interests, zodiac = @zodiac, hair = @hair, eyes = @eyes,
           response_time = @response_time, rating = @rating, reviews_count = @reviews_count,
           is_online = @is_online, is_verified = @is_verified, is_featured = @is_featured, accent = @accent
         WHERE id = @id`,
      ).run({ ...values, id: modelId });
    } else {
      const info = db
        .prepare(
          `INSERT INTO models (user_id, slug, name, age, city, country, tagline, bio, price_cents, height_cm,
             languages, interests, zodiac, hair, eyes, response_time, rating, reviews_count, is_online,
             is_verified, is_featured, accent, created_at)
           VALUES (@user_id, @slug, @name, @age, @city, @country, @tagline, @bio, @price_cents, @height_cm,
             @languages, @interests, @zodiac, @hair, @eyes, @response_time, @rating, @reviews_count, @is_online,
             @is_verified, @is_featured, @accent, @created_at)`,
        )
        .run(values);
      modelId = Number(info.lastInsertRowid);
      created += 1;
    }

    db.prepare("DELETE FROM model_photos WHERE model_id = ?").run(modelId);
    const insertPhoto = db.prepare("INSERT INTO model_photos (model_id, url, position) VALUES (?, ?, ?)");
    photoUrls.forEach((url, position) => insertPhoto.run(modelId, url, position));
  }

  seedDemoConversation(demoUserId);

  console.log(`models: ${SEED_MODELS.length} (${created} new), posters rendered: ${renderedPhotos}`);
  console.log(`\nAccounts\n  admin   ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`  member  ${DEMO_USER.email} / ${DEMO_USER.password}`);
  console.log(`  model   sofia@aurea.chat / ${MODEL_PASSWORD} (any first name @aurea.chat)`);
}

/** One approved order + conversation so the demo account has chat history on first login. */
function seedDemoConversation(userId: number) {
  const model = db.prepare("SELECT id, name FROM models ORDER BY id LIMIT 1").get() as
    | { id: number; name: string }
    | undefined;
  if (!model) return;
  const existing = db
    .prepare("SELECT id FROM conversations WHERE user_id = ? AND model_id = ?")
    .get(userId, model.id) as { id: number } | undefined;
  if (existing) return;

  const now = Date.now();
  const orderInfo = db
    .prepare(
      `INSERT INTO orders (code, user_id, model_id, amount_cents, method, status, card_brand, card_last4, card_name, created_at, decided_at)
       VALUES (?, ?, ?, (SELECT price_cents FROM models WHERE id = ?), 'card', 'approved', 'VISA', '4242', 'ALEX MORGAN', ?, ?)`,
    )
    .run(`AUR-DEMO01`, userId, model.id, model.id, now - 86_400_000, now - 86_300_000);

  const conversationInfo = db
    .prepare(
      "INSERT INTO conversations (user_id, model_id, order_id, created_at, last_message_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(userId, model.id, Number(orderInfo.lastInsertRowid), now - 86_300_000, now - 5_400_000);
  const conversationId = Number(conversationInfo.lastInsertRowid);

  const script: { role: "user" | "model"; body: string; offset: number }[] = [
    { role: "model", body: `Hi! I'm ${model.name.split(" ")[0]} — thanks for reaching out. How was your day?`, offset: 86_200_000 },
    { role: "user", body: "Long, but good. Just got back from work. What are you up to?", offset: 82_000_000 },
    { role: "model", body: "Editing photos from last weekend and drinking way too much coffee ☕", offset: 79_000_000 },
    { role: "user", body: "Show me one of them sometime?", offset: 12_000_000 },
    { role: "model", body: "Deal. Tell me about the last film you actually loved first.", offset: 5_400_000 },
  ];

  const insert = db.prepare(
    `INSERT INTO messages (conversation_id, sender_role, body, image_url, created_at, read_by_user, read_by_model)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
  );
  for (const line of script) {
    insert.run(
      conversationId,
      line.role,
      line.body,
      now - line.offset,
      line.role === "user" ? 1 : 1,
      line.role === "model" ? 1 : 1,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
