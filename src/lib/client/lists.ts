"use client";

import type { Pack } from "@/lib/types";
import { useLocalStore } from "./local-store";

const EMPTY_IDS: string[] = [];
const EMPTY_BASKET: StoredBasketItem[] = [];

export function useFavorites() {
  const [ids, update, hydrated] = useLocalStore<string[]>("satplus:favorites:v1", EMPTY_IDS);
  const safe = Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : EMPTY_IDS;
  return {
    ids: safe,
    hydrated,
    has: (id: string) => safe.includes(id),
    toggle: (id: string) =>
      update((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list].slice(0, 200);
      }),
  };
}

export type StoredBasketItem = { productId: string; quantity: number; pack?: Pack | null };

function sanitize(items: unknown): StoredBasketItem[] {
  if (!Array.isArray(items)) return EMPTY_BASKET;
  return items
    .filter(
      (i): i is StoredBasketItem =>
        !!i && typeof i.productId === "string" && typeof i.quantity === "number" && i.quantity > 0 && i.quantity <= 1000,
    )
    .slice(0, 60);
}

export function useBasket() {
  const [raw, update, hydrated] = useLocalStore<StoredBasketItem[]>("satplus:basket:v1", EMPTY_BASKET);
  const items = sanitize(raw);
  return {
    items,
    hydrated,
    has: (id: string) => items.some((i) => i.productId === id),
    add: (productId: string, quantity = 1) =>
      update((prev) => {
        const list = sanitize(prev);
        return list.some((i) => i.productId === productId) ? list : [...list, { productId, quantity }];
      }),
    set: (productId: string, patch: Partial<StoredBasketItem>) =>
      update((prev) => sanitize(prev).map((i) => (i.productId === productId ? { ...i, ...patch } : i))),
    remove: (productId: string) => update((prev) => sanitize(prev).filter((i) => i.productId !== productId)),
    clear: () => update(() => []),
  };
}
