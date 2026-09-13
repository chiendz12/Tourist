import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingService } from './rating.service';

@ApiTags('rating')
@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Public()
  @Get('destination/:destinationId')
  findByDestination(@Param('destinationId') destinationId: string) {
    return this.ratingService.findByDestination(destinationId);
  }

  @ApiBearerAuth()
  @Roles(Role.MEMBER, Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Post()
  upsert(@Body() dto: CreateRatingDto, @CurrentUser('id') userId: string) {
    return this.ratingService.upsert(dto, userId);
  }
}
