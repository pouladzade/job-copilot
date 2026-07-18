import { IsIn, IsString } from 'class-validator';
import { APPLICATION_STATUSES } from '@job-hunter/shared';
import type { ApplicationStatus } from '@job-hunter/shared';

export class UpdateStatusDto {
  @IsString()
  @IsIn(APPLICATION_STATUSES)
  readonly status!: ApplicationStatus;
}