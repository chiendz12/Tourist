import { BadRequestException } from '@nestjs/common';
import { Coordinates } from '../types';

export function assertCoordinates(lng: number, lat: number): Coordinates {
  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    throw new BadRequestException('Invalid coordinates');
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw new BadRequestException('Coordinates out of range');
  }
  return { lng, lat };
}

export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
