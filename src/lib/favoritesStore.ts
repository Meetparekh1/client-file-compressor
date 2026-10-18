/**
 * Favorites Store
 * Stores favorited tool IDs in browser storage (localStorage) with reactive subscriptions.
 */

const FAVORITES_STORAGE_KEY = 'shrinkbyte_favorites';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isFavorite(toolId: string): boolean {
  const favs = getFavorites();
  return favs.includes(toolId);
}

export function toggleFavorite(toolId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getFavorites();
    const exists = current.includes(toolId);
    let next: string[];
    if (exists) {
      next = current.filter((id) => id !== toolId);
    } else {
      next = [...current, toolId];
    }
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    notify();
    return !exists;
  } catch {
    return false;
  }
}

export function subscribeFavorites(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
