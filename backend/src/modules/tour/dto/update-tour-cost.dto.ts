import { PartialType } from '@nestjs/swagger';
import { CreateTourCostDto } from './create-tour-cost.dto';

export class UpdateTourCostDto extends PartialType(CreateTourCostDto) {}
