import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, ListDocumentsDto } from './dto/document.dto';

type Admin = { id: string };

/// Item 11 — documents are addressed by user id + job id, and the by-user
/// view returns the owner's full profile alongside them.
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(@Query() query: ListDocumentsDto) {
    return this.documents.list(query);
  }

  /// GET /documents/by-user?workerId=...&jobId=... — profile + documents
  /// grouped into one folder per job.
  @Get('by-user')
  byUser(
    @Query('workerId') workerId?: string,
    @Query('employerId') employerId?: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.documents.byUser({ workerId, employerId, jobId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documents.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDocumentDto, @CurrentUser() admin: Admin) {
    return this.documents.create(dto, admin.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() admin: Admin) {
    return this.documents.remove(id, admin.id);
  }
}
