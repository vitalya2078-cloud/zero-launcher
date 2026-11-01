export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export type Gift = {
  id: string;
  name: string;
  kind: "nft" | "stars" | "key" | "regular";
  rarity: Rarity;
  value: number;
  image_url: string | null;
  animation_url: string | null;
};

export type CaseItem = Gift & { chance: number };

export type CaseCard = {
  id: string;
  name: string;
  category: "special" | "referral" | "price" | "gift" | "theme" | "custom";
  description: string | null;
  badge: string | null;
  price: number;
  base_price: number;
  pay_mode: "stars" | "free" | "keys";
  price_keys: number | null;
  cooldown_until: string | null;
  opens_left: number | null;
  available_until: string | null;
  cover: Gift | null;
  max_value: number;
  items_count: number;
};

export type CaseFull = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  base_price: number;
  pay_mode: "stars" | "free" | "keys";
  price_keys: number | null;
  free_cooldown_h: number | null;
  items: CaseItem[];
};

export type Profile = {
  tg_id: number;
  first_name: string | null;
  username: string | null;
  photo_url: string | null;
  balance: number;
  xp: number;
  level: number;
  level_xp: number;
  next_level_xp: number;
  referral_keys: number;
  daily_streak: number;
  daily_available_at: string;
  daily_next_amount: number;
  rescue_available: boolean;
  invited: number;
  invited_active: number;
  is_admin: boolean;
  is_new?: boolean;
};

export type InventoryItem = Omit<Gift, "id"> & {
  id: number; // id записи инвентаря
  gift_id: string;
  value_at_drop: number;
  source: string;
  obtained_at: string;
};

export type Drop = Gift & { user: string; uid: string | null; source: string; at: string };

export type LbKind = "won" | "level" | "inventory";
export type LbItem = { id: string; user: string; photo_url: string | null; level: number; score: number; rank: number; me: boolean };
export type Leaderboard = { kind: LbKind; items: LbItem[]; me: { rank: number; score: number } | null };

export type PlayerWin = Gift & { source: string; at: string };
export type PlayerProfile = {
  id: string;
  user: string;
  photo_url: string | null;
  level: number;
  me: boolean;
  total_won: number;
  cases_opened: number;
  since: string;
  collection_value: number;
  collection_count: number;
  collection: (Gift & { inv_id: number })[];
  best: Gift | null;
  recent: PlayerWin[];
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  kind: "stat" | "subscribe";
  period: "once" | "daily";
  target: number;
  progress: number | null;
  reward_stars: number;
  reward_keys: number;
  url: string | null;
  claimed: boolean;
};
