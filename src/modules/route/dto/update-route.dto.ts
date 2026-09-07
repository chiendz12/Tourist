import { PartialType } from '@nestjs/swagger';
import { CreateRouteDto } from './create-route.dto';

/** Supplying `waypoints` replaces the whole ordered list. */
export class UpdateRouteDto extends PartialType(CreateRouteDto) {}
