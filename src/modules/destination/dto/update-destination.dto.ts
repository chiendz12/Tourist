import { PartialType } from '@nestjs/swagger';
import { CreateDestinationDto } from './create-destination.dto';

/** Every field optional; `lng`/`lat` must be supplied together to move the point. */
export class UpdateDestinationDto extends PartialType(CreateDestinationDto) {}
