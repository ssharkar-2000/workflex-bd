import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateEmployerDto, ListEmployersDto, UpdateEmployerDto } from './dto/employer.dto';
import { EmployersService } from './employers.service';

type Admin = { id: string };

@Controller('employers')
@UseGuards(JwtAuthGuard)
export class EmployersController {
  constructor(private readonly employers: EmployersService) {}

  @Get()
  list(@Query() query: ListEmployersDto) {
    return this.employers.list(query);
  }

  @Get('counts')
  counts() {
    return this.employers.counts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEmployerDto, @CurrentUser() admin: Admin) {
    return this.employers.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployerDto, @CurrentUser() admin: Admin) {
    return this.employers.update(id, dto, admin.id);
  }
}
