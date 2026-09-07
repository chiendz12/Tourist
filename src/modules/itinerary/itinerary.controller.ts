import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { CreateItineraryDto } from './dto/create-itinerary.dto';
import { UpdateItineraryDto } from './dto/update-itinerary.dto';
import { ItineraryService } from './itinerary.service';

@ApiBearerAuth()
@ApiTags('itinerary')
@Controller('itinerary')
export class ItineraryController {
  constructor(private readonly itineraryService: ItineraryService) {}

  @Roles(Role.MEMBER, Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Get('mine')
  findMine(@CurrentUser('id') userId: string) {
    return this.itineraryService.findMine(userId);
  }

  @Roles(Role.MEMBER, Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateItineraryDto, @CurrentUser('id') userId: string) {
    return this.itineraryService.create(dto, userId);
  }

  @Roles(Role.MEMBER, Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateItineraryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.itineraryService.update(id, dto, userId);
  }
}
