import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { APPLICATION_STATUSES } from '../constants';
import type { ApplicationStatus } from '../constants';
import { ScreeningAnswerDto } from './application-draft.dto';

export class SaveApplicationDto {
  @ApiProperty({ description: 'Application status', enum: APPLICATION_STATUSES })
  @IsString()
  @IsIn(APPLICATION_STATUSES)
  readonly status!: ApplicationStatus;

  @ApiProperty({ description: 'User-edited professional summary' })
  @IsString()
  readonly resumeSummary!: string;

  @ApiProperty({ description: 'User-edited cover letter' })
  @IsString()
  readonly coverLetter!: string;

  @ApiProperty({ description: 'User-edited screening answers', type: [ScreeningAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreeningAnswerDto)
  readonly screeningAnswers!: ScreeningAnswerDto[];

  @ApiPropertyOptional({ description: 'Optional notes about this application' })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}