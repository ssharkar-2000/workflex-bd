import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CmsService } from './cms.service';
import { CreateCmsBlockDto, ListCmsDto, UpdateCmsBlockDto } from './dto/cms.dto';

type Admin = { id: string };

@Controller('cms')
@UseGuards(JwtAuthGuard)
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get()
  list(@Query() query: ListCmsDto) {
    return this.cms.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cms.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCmsBlockDto, @CurrentUser() admin: Admin) {
    return this.cms.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCmsBlockDto, @CurrentUser() admin: Admin) {
    return this.cms.update(id, dto, admin.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.cms.remove(id, admin.id);
  }
}
