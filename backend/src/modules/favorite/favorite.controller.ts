import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { FavoriteService } from './favorite.service';

@ApiBearerAuth()
@ApiTags('favorite')
@Roles(Role.MEMBER, Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
@Controller('favorite')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get()
  findMine(@CurrentUser('id') userId: string) {
    return this.favoriteService.findMine(userId);
  }

  @Post(':destinationId')
  add(@Param('destinationId') destinationId: string, @CurrentUser('id') userId: string) {
    return this.favoriteService.add(userId, destinationId);
  }

  @Delete(':destinationId')
  remove(@Param('destinationId') destinationId: string, @CurrentUser('id') userId: string) {
    return this.favoriteService.remove(userId, destinationId);
  }
}
