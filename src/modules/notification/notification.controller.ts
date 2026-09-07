import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationService } from './notification.service';

@ApiBearerAuth()
@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findMine(@Query() query: QueryNotificationDto, @CurrentUser('id') userId: string) {
    return this.notificationService.findMine(userId, query, query.unreadOnly === 'true');
  }

  // Static segment must come before ':id/read'.
  @Patch('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationService.markAllRead(userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationService.markRead(id, userId);
  }
}
