import { apiFetch } from "./client";
import type {
  ApprovalRecord,
  AuthResult,
  ClassItem,
  Comment,
  CurrentUser,
  Destination,
  FavoriteRecord,
  HocPhanCode,
  AdminUser,
  AuditRecord,
  ItinerarySummary,
  MapboxGeocodeFeature,
  Notification,
  Paginated,
  Province,
  Rating,
  Supplier,
  Tour,
  TourRoute,
} from "./types";

type Query = Record<
  string,
  string | number | boolean | null | undefined | readonly string[]
>;

const json = <T>(path: string, init?: Parameters<typeof apiFetch>[1]) =>
  apiFetch<T>(path, init);

/* Auth */

export const authApi = {
  login: (email: string, password: string) =>
    json<AuthResult>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  register: (body: {
    email: string;
    username: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => json<AuthResult>("/auth/register", { method: "POST", body }),
  refresh: (refreshToken: string) =>
    json<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    }),
  logout: () => json<void>("/auth/logout", { method: "POST" }),
  me: () => json<CurrentUser | null>("/user/me"),
  myProvinces: () =>
    json<Array<{ provinceId: string; province: Province }>>("/user/me/provinces"),
};

/* Geo helpers */

export const geoApi = {
  geocode: (q: string) =>
    json<{ features: MapboxGeocodeFeature[] }>("/mapbox/geocode", {
      query: { q },
      public: true,
      revalidate: 300,
    }),
  reverse: (lng: number, lat: number) =>
    json<{ features: MapboxGeocodeFeature[] }>("/mapbox/reverse", {
      query: { lng, lat },
      public: true,
      revalidate: 300,
    }),
  /** OpenStreetMap search proxied via our backend (browser OSM calls get blocked/throttled). */
  search: (q: string, viewbox?: string) =>
    json<Array<{ id: string; name: string; address: string; lng: number; lat: number }>>(
      "/mapbox/search",
      { query: viewbox ? { q, viewbox } : { q }, public: true, revalidate: 300 },
    ),
};

/** Road routing through our backend (server-side Mapbox token). */
export interface DirectionsRoute {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance: number;
  duration: number;
}

export const mapboxApi = {
  directions: (from: { lng: number; lat: number }, to: { lng: number; lat: number }) =>
    json<{ routes?: DirectionsRoute[] }>("/mapbox/directions", {
      method: "POST",
      body: { coordinates: [from, to] },
    }),
};

/* Provinces */

export const provincesApi = {
  list: () => json<Province[]>("/province", { public: true, revalidate: 300 }),
};

/* Destinations */

export const destinationsApi = {
  list: (q?: Query) =>
    json<Paginated<Destination>>("/destination", { query: q, public: true, revalidate: 60 }),
  bbox: (q: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    limit?: number;
    category?: string;
    provinceId?: string;
    q?: string;
  }) =>
    json<Destination[]>("/destination/bbox", { query: q, public: true, revalidate: 60 }),
  nearby: (q: {
    lng: number;
    lat: number;
    radius: number;
    limit?: number;
    category?: string;
  }) => json<Destination[]>("/destination/nearby", { query: q, public: true, revalidate: 60 }),
  get: (id: string) =>
    // Authenticated (NOT public): the backend attaches req.user on public
    // routes when a token is present, but the /pub proxy never forwards
    // cookies — so a public fetch is always anonymous and can only read
    // PUBLISHED. Owners must fetch their DRAFT / PENDING records with the
    // bearer token, otherwise EnterPage gets a 404 and bounces back to
    // /studio/mine (looks like "nothing happened" on click). No revalidate:
    // user-specific reads must never hit the shared Data Cache.
    json<Destination>(`/destination/${id}`),
  create: (body: object) =>
    json<Destination>("/destination", { method: "POST", body }),
  update: (id: string, body: object) =>
    json<Destination>(`/destination/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    json<{ id: string; deleted: boolean }>(`/destination/${id}`, {
      method: "DELETE",
    }),
  mine: (q?: Query) => json<Paginated<Destination>>("/destination/mine", { query: q }),
  resolveImage: (id: string) =>
    json<{ id: string; images: string[] }>(`/destination/${id}/resolve-image`, {
      method: "POST",
    }),
};

/* Routes */

export const routesApi = {
  list: (q?: Query) =>
    json<Paginated<TourRoute>>("/route", { query: q, public: true, revalidate: 60 }),
  mine: (q?: Query) => json<Paginated<TourRoute>>("/route/mine", { query: q }),
  get: (id: string) => json<TourRoute>(`/route/${id}`, { public: true, revalidate: 30 }),
  create: (body: object) =>
    json<TourRoute>("/route", { method: "POST", body }),
  update: (id: string, body: object) =>
    json<TourRoute>(`/route/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    json<{ id: string; deleted: boolean }>(`/route/${id}`, {
      method: "DELETE",
    }),
  recalculate: (id: string) =>
    json<unknown>(`/route/${id}/recalculate`, { method: "POST" }),
};

/* Tours */

export const toursApi = {
  list: (q?: Query) => json<Paginated<Tour>>("/tour", { query: q, public: true, revalidate: 60 }),
  mine: (q?: Query) => json<Paginated<Tour>>("/tour/mine", { query: q }),
  get: (id: string) => json<Tour>(`/tour/${id}`, { public: true, revalidate: 30 }),
  pricing: (id: string) =>
    json<unknown>(`/tour/${id}/pricing`, { public: true, revalidate: 60 }),
  create: (body: object) => json<Tour>("/tour", { method: "POST", body }),
  update: (id: string, body: object) =>
    json<Tour>(`/tour/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    json<{ id: string; deleted: boolean }>(`/tour/${id}`, {
      method: "DELETE",
    }),
  costs: {
    list: (tourId: string) =>
      json<unknown[]>(`/tour/${tourId}/costs`, { public: true, revalidate: 60 }),
    create: (tourId: string, body: object) =>
      json<unknown>(`/tour/${tourId}/costs`, { method: "POST", body }),
    update: (tourId: string, costId: string, body: object) =>
      json<unknown>(`/tour/${tourId}/costs/${costId}`, {
        method: "PATCH",
        body,
      }),
    remove: (tourId: string, costId: string) =>
      json<unknown>(`/tour/${tourId}/costs/${costId}`, {
        method: "DELETE",
      }),
  },
};

/* Suppliers (public list) */

export const suppliersApi = {
  list: (q?: Query) =>
    json<Paginated<Supplier>>("/provider", { query: q, public: true, revalidate: 60 }),
};

/* Hotels & food (POI) */

export const poiApi = {
  hotelsFood: (params: {
    south: number;
    west: number;
    north: number;
    east: number;
    types?: Array<"hotel" | "restaurant">;
  }) =>
    json<{ hotels: unknown[]; restaurants: unknown[] }>(
      "/poi/hotels-food",
      { query: { ...params, types: (params.types ?? ["hotel", "restaurant"]).join(",") } },
    ),
};

/* Ratings + comments (public read; auth write) */

export const ratingsApi = {
  forDestination: (destinationId: string) =>
    json<Rating[]>(`/rating/destination/${destinationId}`, { public: true, revalidate: 30 }),
  create: (body: {
    destinationId: string;
    score: number;
    review?: string;
  }) => json<Rating>("/rating", { method: "POST", body }),
};

export const itinerariesApi = {
  mine: () => json<ItinerarySummary[]>("/itinerary/mine"),
  get: (id: string) => json<ItinerarySummary>(`/itinerary/${id}`),
  create: (body: { name: string; payload: unknown }) =>
    json<unknown>("/itinerary", { method: "POST", body }),
  update: (id: string, body: { name?: string; payload?: unknown }) =>
    json<unknown>(`/itinerary/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    json<{ id: string; deleted: boolean }>(`/itinerary/${id}`, {
      method: "DELETE",
    }),
};

export const approvalsApi = {
  summary: () =>
    json<{ total: number; pending: number; byStatus: Record<string, number> }>(
      "/approval/summary",
    ),
  // NOTE: the endpoint is paginated ({ data, meta }), not a bare array.
  queue: (q?: Query) => json<Paginated<ApprovalRecord>>("/approval", { query: q }),
  review: (id: string, body: { action: "APPROVE" | "REJECT"; comment?: string }) =>
    json<unknown>(`/approval/${id}/review`, { method: "PATCH", body }),
  submit: (body: { entityType: string; entityId: string }) =>
    json<unknown>("/approval/submit", { method: "POST", body }),
};

export const adminApi = {
  overview: () =>
    json<{
      users: number;
      usersByRole: Record<string, number>;
      destinations: number;
      publishedDestinations: number;
      routes: number;
      tours: number;
      suppliers: number;
      pendingApprovals: number;
    }>("/admin/overview"),
  users: (q?: Query) => json<Paginated<AdminUser>>("/admin/users", { query: q }),
  updateUser: (id: string, body: { role?: string; isActive?: boolean; fullName?: string; phone?: string }) =>
    json<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body }),
  audit: (q?: Query) =>
    json<Paginated<AuditRecord>>("/admin/audit", { query: q }),
  pendingUsers: (q?: Query) => json<Paginated<AdminUser>>("/admin/user-approvals", { query: q }),
  reviewUser: (id: string, action: "APPROVE" | "REJECT") =>
    json<unknown>(`/admin/user-approvals/${id}`, { method: "PATCH", body: { action } }),
};

export const classesApi = {
  // Bare array (not paginated) inside the standard envelope.
  list: () => json<ClassItem[]>("/class"),
  get: (id: string) => json<ClassItem>(`/class/${id}`),
};

export const commentsApi = {
  forDestination: (destinationId: string) =>
    json<Comment[]>(`/comment/destination/${destinationId}`, { public: true, revalidate: 30 }),
  create: (body: {
    destinationId: string;
    content: string;
    parentId?: string;
  }) => json<Comment>("/comment", { method: "POST", body }),
};

/* Favorites (auth-only) */

export const favoritesApi = {
  list: () => json<FavoriteRecord[]>("/favorite"),
  add: (destinationId: string) =>
    json<{ destinationId: string; favorited: boolean }>(
      `/favorite/${destinationId}`,
      { method: "POST" },
    ),
  remove: (destinationId: string) =>
    json<{ destinationId: string; favorited: boolean }>(
      `/favorite/${destinationId}`,
      { method: "DELETE" },
    ),
};

/* Notifications (auth) */

export const notificationsApi = {
  list: (q?: Query) => json<Paginated<Notification>>("/notification", { query: q }),
  markRead: (id: string) =>
    json<{ id: string; read: boolean }>(`/notification/${id}/read`, {
      method: "PATCH",
    }),
  markAllRead: () =>
    json<{ read: number }>("/notification/read-all", { method: "PATCH" }),
};

/* Hoc phan (curriculum) */

export const hocPhanApi = {
  list: () =>
    json<
      Array<{
        id: string;
        code: HocPhanCode;
        name: string;
        description?: string | null;
      }>
    >("/hocphan", { public: true, revalidate: 300 }),
  enroll: (hocPhanCode: HocPhanCode) =>
    json<unknown>("/hocphan/enroll", {
      method: "POST",
      body: { hocPhanCode },
    }),
};
