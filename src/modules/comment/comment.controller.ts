import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comment')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Public()
  @Get('destination/:destinationId')
  findByDestination(@Param('destinationId') destinationId: string) {
    return this.commentService.findByDestination(destinationId);
  }

  @ApiBearerAuth()
  @Roles(Role.MEMBER, Role.STUDENT, Role.LEADER, Role.LECTURER, Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateCommentDto, @CurrentUser('id') userId: string) {
    return this.commentService.create(dto, userId);
  }
}
