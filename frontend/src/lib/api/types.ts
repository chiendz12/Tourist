/** Mirrors the NestJS backend contract. */

export type Role =
  | "GUEST"
  | "MEMBER"
  | "STUDENT"
  | "LEADER"
  | "LECTURER"
  | "SUPER_ADMIN";

export const ROLE_RANK: Record<Role, number> = {
  GUEST: 0,
  MEMBER: 1,
  STUDENT: 2,
  LEADER: 3,
  LECTURER: 4,
  SUPER_ADMIN: 5,
};

export type HocPhanCode = "HP1" | "HP2" | "HP3";

export type EntityType = "DESTINATION" | "ROUTE" | "TOUR" | "SUPPLIER" | "TOUR_COST";

export type ApprovalStatus =
  | "DRAFT"
  | "PENDING_LEADER"
  | "PENDING_LECTURER"
  | "PENDING_ADMIN"
  | "PUBLISHED"
  | "REJECTED";

export type DestinationCategory =
  | "NATURE"
  | "CULTURE"
  | "HISTORY"
  | "CUISINE"
  | "ENTERTAINMENT"
  | "RELIGION"
  | "OTHER";

export type SupplierType = "HOTEL" | "RESTAURANT" | "TRANSPORT" | "GUIDE" | "OTHER";

export type CostCategory =
  | "HOTEL"
  | "MEAL"
  | "TRANSPORT"
  | "TICKET"
  | "GUIDE"
  | "INSURANCE"
  | "MISC";

export type AgeGroup =
  | "CHILD"
  | "TEEN"
  | "ADULT"
  | "SENIOR"
  | "FAMILY"
  | "ALL";

export type TravelStyle =
  | "RELAX"
  | "ADVENTURE"
  | "CULTURE"
  | "CUISINE"
  | "ECO"
  | "EDUCATION"
  | "SHOPPING"
  | "NIGHTLIFE";

export type Season =
  | "SPRING"
  | "SUMMER"
  | "AUTUMN"
  | "WINTER"
  | "ALL_YEAR";

/* Geo primitives */

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoLineString {
  type: "LineString";
  coordinates: [number, number][];
}

/* Domain entities */

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: Role;
  phone?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResult {
  user: CurrentUser;
  accessToken: string;
  refreshToken: string;
}

export interface Province {
  id: string;
  code: string;
  name: string;
  region?: string | null;
}

export interface Destination {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category: DestinationCategory;
  address?: string | null;
  provinceId?: string | null;
  images: string[];
  openingHours?: unknown;
  ticketPrice?: string | number | null;
  status: ApprovalStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lng: number;
  lat: number;
  location: GeoPoint;
  distanceM?: number;
}

export interface RouteWaypoint {
  id: string;
  routeId: string;
  destinationId: string;
  order: number;
  stayMinutes?: number | null;
  notes?: string | null;
  destination?: Destination;
}

export interface TourRoute {
  id: string;
  name: string;
  description?: string | null;
  path: GeoLineString | null;
  distanceM?: number | null;
  durationS?: number | null;
  status: ApprovalStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  waypoints?: RouteWaypoint[];
}

export interface Tour {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  routeId?: string | null;
  days: number;
  basePrice: string | number;
  currency: string;
  paxCount: number;
  targetAgeGroups: AgeGroup[];
  travelStyles: TravelStyle[];
  seasons: Season[];
  status: ApprovalStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  route?: TourRoute;
}

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  provinceId?: string | null;
  status?: ApprovalStatus;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  rating?: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface Rating {
  id: string;
  userId: string;
  destinationId: string;
  score: number;
  review?: string | null;
  moderationStatus?: ApprovalStatus;
  createdAt: string;
  user?: { id: string; fullName: string; avatarUrl?: string | null };
}

export interface Comment {
  id: string;
  userId: string;
  destinationId: string;
  content: string;
  parentId?: string | null;
  moderationStatus?: ApprovalStatus;
  createdAt: string;
  user?: { id: string; fullName: string; avatarUrl?: string | null };
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: {
    entityType?: string;
    entityId?: string;
    status?: string;
    userId?: string;
    role?: string;
  } | null;
  readAt?: string | null;
  createdAt: string;
}

export interface FavoriteRecord {
  destinationId: string;
  createdAt: string;
}

export interface ClassGroup {
  id: string;
  classId: string;
  name: string;
}

export interface ClassMember {
  classId: string;
  userId: string;
  isLeader: boolean;
  groupId?: string | null;
  joinedAt: string;
  user?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    role: string;
  } | null;
  group?: { id: string; classId: string; name: string } | null;
}

export interface ClassItem {
  id: string;
  name: string;
  code: string;
  hocPhanId?: string | null;
  lecturerId?: string | null;
  provinceId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  hocPhan?: { id: string; code: string; name: string; description?: string | null } | null;
  province?: { id: string; code: string; name: string; region?: string | null } | null;
  groups?: ClassGroup[];
  members?: ClassMember[];
  _count?: { members: number };
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  isApproved: boolean;
  emailVerified?: boolean;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  createdAt: string;
  user?: { id: string; fullName: string; email: string; role: string } | null;
}

export interface ApprovalRecord {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  currentLevel: string;
  createdAt: string;
  updatedAt: string;
  submittedById?: string;
  entity?: {
    id: string;
    name: string;
    address?: string | null;
    images?: string[];
    category?: string;
    status?: string;
    code?: string;
    description?: string | null;
    province?: { id: string; name: string } | null;
    createdBy?: { fullName: string } | null;
  } | null;
  submittedBy?: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
  history?: Array<{
    id: string;
    level: string;
    action: string;
    comment?: string | null;
    createdAt: string;
  }>;
}

/** Builder payload stored on itineraries (days with destination stop ids). */
export interface ItineraryPayload {
  days?: Array<{ day: number; stops: string[] }>;
  travelers?: number;
}

export interface ItinerarySummary {
  id: string;
  name: string;
  /** Absent on older rows — always fall back to createdAt. */
  updatedAt?: string;
  createdAt: string;
  payload?: ItineraryPayload | null;
}

/* Mapbox geocode */

export interface MapboxGeocodeFeature {
  id: string;
  type: "Feature";
  text?: string;
  place_name?: string;
  center?: [number, number];
  geometry?: { type: "Point"; coordinates: [number, number] };
}
