import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsInt, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class JobPostingDto {
  @ApiProperty({ description: 'Schema version for migration support' })
  @IsInt()
  @Equals(1)
  readonly schemaVersion!: 1;

  @ApiProperty({ description: 'Job title', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  readonly title!: string;

  @ApiProperty({ description: 'Company name', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  readonly company!: string;

  @ApiProperty({ description: 'Job location', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  readonly location!: string;

  @ApiProperty({ description: 'Combined job description and requirements', maxLength: 50000 })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  readonly description!: string;

  @ApiProperty({ description: 'Source URL of the job posting', maxLength: 2048 })
  @IsUrl()
  @MaxLength(2048)
  readonly sourceUrl!: string;

  @ApiProperty({ description: 'Adapter ID (e.g., greenhouse, linkedin)', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  readonly sourceSite!: string;

  @ApiPropertyOptional({ description: 'Optional explicit resume filename hint', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly resumeHint?: string | null;
}