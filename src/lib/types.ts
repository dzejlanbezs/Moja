export type Role = "user" | "model" | "admin";

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
  balance_cents: number;
  avatar_url: string | null;
  created_at: number;
};

export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  balanceCents: number;
  avatarUrl: string | null;
};

export type ModelRow = {
  id: number;
  user_id: number | null;
  slug: string;
  name: string;
  age: number;
  city: string;
  country: string;
  tagline: string;
  bio: string;
  price_cents: number;
  height_cm: number;
  languages: string;
  interests: string;
  zodiac: string;
  hair: string;
  eyes: string;
  response_time: string;
  rating: number;
  reviews_count: number;
  is_online: number;
  is_verified: number;
  is_featured: number;
  accent: string;
  created_at: number;
};

export type CatalogModel = {
  id: number;
  slug: string;
  name: string;
  age: number;
  city: string;
  country: string;
  tagline: string;
  priceCents: number;
  rating: number;
  reviewsCount: number;
  isOnline: boolean;
  isVerified: boolean;
  accent: string;
  cover: string;
  photoCount: number;
};

export type ModelDetail = CatalogModel & {
  bio: string;
  heightCm: number;
  languages: string[];
  interests: string[];
  zodiac: string;
  hair: string;
  eyes: string;
  responseTime: string;
  photos: string[];
};

export type OrderStatus = "pending" | "approved" | "rejected";

export type ChatMessage = {
  id: number;
  conversationId: number;
  senderRole: "user" | "model";
  body: string | null;
  imageUrl: string | null;
  createdAt: number;
  mine: boolean;
};
