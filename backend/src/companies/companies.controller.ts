import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, ListCompaniesDto, UpdateCompanyDto } from './dto/company.dto';

type Admin = { id: string };

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  list(@Query() query: ListCompaniesDto) {
    return this.companies.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companies.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto, @CurrentUser() admin: Admin) {
    return this.companies.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto, @CurrentUser() admin: Admin) {
    return this.companies.update(id, dto, admin.id);
  }
}
