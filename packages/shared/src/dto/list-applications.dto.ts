import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { APPLICATION_STATUSES } from '../constants';
import type { ApplicationStatus } from '../constants';

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by company name (ILIKE)' })
  @IsOptional()
  @IsString()
  readonly company?: string;

  @ApiPropertyOptional({ description: 'Filter by application status', enum: APPLICATION_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(APPLICATION_STATUSES)
  readonly status?: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Filter by resume version used' })
  @IsOptional()
  @IsString()
  readonly resumeUsed?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly page?: number;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  readonly limit?: number;
}

export class ListApplicationsResponseDto {
  @ApiProperty({ description: 'Total number of matching applications' })
  @IsNumber()
  readonly total!: number;

  @ApiProperty({ description: 'Current page number' })
  @IsNumber()
  readonly page!: number;

  @ApiProperty({ description: 'Total number of pages' })
  @IsNumber()
  readonly totalPages!: number;

  @ApiProperty({ description: 'Applications for the current page' })
  readonly applications!: ReadonlyArray<Record<string, unknown>>;
}