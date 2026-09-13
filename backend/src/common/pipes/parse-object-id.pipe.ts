import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException('Invalid id');
    }
    return value;
  }
}
