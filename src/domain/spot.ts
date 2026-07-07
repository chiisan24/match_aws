/**
 * Pure spot helpers shared by the adapters and the app.
 *
 * `buildSpotFromInput` turns the user-supplied {@link NewSpotInput} into a full
 * {@link Spot}: it trims fields, drops non-http(s) websites, and fills a
 * name-based Japanese description when none is given. It takes the id as an
 * argument so the caller controls id generation (mock: local uuid; API: the
 * value stored in DynamoDB), keeping the function pure and testable.
 */

import type { NewSpotInput, Spot } from "./types";

const CATEGORY_JA: Record<Spot["category"], string> = {
  sightseeing: "観光スポット",
  food: "飲食店",
  onsen: "温泉",
  souvenir: "みやげ",
};

/** Best-effort unique id for a user-added spot (works in browser + Node). */
export function newSpotId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return `user-${c.randomUUID()}`;
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Build a full {@link Spot} from user input. Pure — no id generation inside. */
export function buildSpotFromInput(input: NewSpotInput, id: string): Spot {
  const name = input.name.trim();
  const website =
    input.website && /^https?:\/\//i.test(input.website.trim())
      ? input.website.trim()
      : undefined;
  return {
    id,
    name,
    category: input.category,
    location: { lat: input.location.lat, lng: input.location.lng },
    localizedDescriptions: {
      ja: input.descriptionJa?.trim() || `${name}（${CATEGORY_JA[input.category]}）`,
    },
    reviews: [],
    imageUrls: [],
    openingHours: input.openingHours?.trim() || undefined,
    website,
  };
}
