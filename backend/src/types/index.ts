import { Role } from '@prisma/client';

export type JwtUser = {
  id: string;
  email: string;
  role: Role;
  fullName?: string;
};

export type Coordinates = {
  lng: number;
  lat: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
