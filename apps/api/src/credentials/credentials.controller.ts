import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CredentialsService } from './credentials.service';

@ApiTags('credentials')
@ApiBearerAuth()
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentials: CredentialsService) {}

  /** Declared before `:id`-shaped routes, as everywhere else in this API. */
  @Get('issuers')
  @ApiOperation({ summary: 'Institutions that can attest to a credential' })
  async issuers() {
    return this.credentials.issuers();
  }

  @Get('ledger')
  @ApiOperation({
    summary: 'Walk the whole record and report whether it has been tampered with',
  })
  async ledger() {
    return this.credentials.checkLedger();
  }

  @Get('me')
  @ApiOperation({ summary: 'Your own credentials, each re-checked on the way out' })
  async mine(@CurrentUser('userId') userId: string) {
    return this.credentials.mine(userId);
  }

  /**
   * An applicant's credentials, for the person who posted the job.
   *
   * Under /jobs rather than /credentials would have read better, but the
   * authorisation lives in this service and splitting a route from the code
   * that guards it is how a guard eventually gets forgotten.
   */
  @Get('applicant/:jobId/:userId')
  @ApiOperation({ summary: "One applicant's credentials, checked" })
  async forApplicant(
    @CurrentUser('userId') ownerId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Param('userId', ParseUUIDPipe) applicantId: string,
  ) {
    return this.credentials.forApplicant(ownerId, jobId, applicantId);
  }
}
