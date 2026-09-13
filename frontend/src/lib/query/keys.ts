/**
 * Centralised TanStack Query keys. Keep keys structured so related caches can be
 * invalidated together (e.g. `qk.destinations.all`).
 */
export const qk = {
  session: ["session"] as const,
  me: ["me"] as const,
  myProvinces: ["me", "provinces"] as const,

  provinces: { all: ["provinces"] as const },

  destinations: {
    all: ["destinations"] as const,
    list: (params: Record<string, unknown>) =>
      ["destinations", "list", params] as const,
    bbox: (params: Record<string, unknown>) =>
      ["destinations", "bbox", params] as const,
    detail: (id: string) => ["destinations", "detail", id] as const,
  },

  routes: {
    all: ["routes"] as const,
    list: (params: Record<string, unknown>) => ["routes", "list", params] as const,
    detail: (id: string) => ["routes", "detail", id] as const,
  },

  tours: {
    all: ["tours"] as const,
    list: (params: Record<string, unknown>) => ["tours", "list", params] as const,
    detail: (id: string) => ["tours", "detail", id] as const,
  },

  ratings: (destinationId: string) => ["ratings", destinationId] as const,
  comments: (destinationId: string) => ["comments", destinationId] as const,

  itineraries: {
    mine: ["itineraries", "mine"] as const,
    detail: (id: string) => ["itineraries", "detail", id] as const,
  },

  favorites: { mine: ["favorites", "mine"] as const },

  notifications: (params: Record<string, unknown>) =>
    ["notifications", params] as const,

  admin: {
    overview: ["admin", "overview"] as const,
  },
} as const;
