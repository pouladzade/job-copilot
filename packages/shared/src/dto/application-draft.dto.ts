import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNumber, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ConfidenceTier, ResumeSelectionReason } from '../constants';

export class ScreeningAnswerDto {
  @ApiProperty({ description: 'Stable hash of the question text for form-field mapping' })
  @IsString()
  readonly questionId!: string;

  @ApiProperty({ description: 'The original question text from the job posting' })
  @IsString()
  readonly question!: string;

  @ApiProperty({ description: 'The generated answer' })
  @IsString()
  readonly answer!: string;

  @ApiProperty({ description: 'Confidence score from 0.0 to 1.0' })
  @IsNumber()
  @Min(0)
  @Max(1)
  readonly confidence!: number;

  @ApiProperty({ description: 'Confidence tier: low, medium, or high' })
  @IsString()
  readonly confidenceTier!: ConfidenceTier;
}

export class TokenUsageDto {
  @ApiProperty({ description: 'Prompt tokens used' })
  @IsNumber()
  readonly promptTokens!: number;

  @ApiProperty({ description: 'Completion tokens used' })
  @IsNumber()
  readonly completionTokens!: number;

  @ApiProperty({ description: 'Total tokens used' })
  @IsNumber()
  readonly totalTokens!: number;

  @ApiProperty({ description: 'Estimated cost in USD' })
  @IsNumber()
  readonly estimatedCostUsd!: number;
}

export class ApplicationDraftDto {
  @ApiProperty({ description: 'Schema version for migration support' })
  @IsNumber()
  readonly schemaVersion!: number;

  @ApiProperty({ description: 'AI-generated professional summary tailored to the job' })
  @IsString()
  readonly resumeSummary!: string;

  @ApiProperty({ description: 'AI-generated cover letter' })
  @IsString()
  readonly coverLetter!: string;

  @ApiProperty({ description: 'Generated answers to screening questions', type: () => [ScreeningAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreeningAnswerDto)
  readonly screeningAnswers!: ScreeningAnswerDto[];

  @ApiProperty({ description: 'Questions the model could not answer', type: [String] })
  @IsArray()
  @IsString({ each: true })
  readonly missingInformation!: string[];

  @ApiProperty({ description: 'Overall confidence score from 0.0 to 1.0' })
  @IsNumber()
  @Min(0)
  @Max(1)
  readonly overallConfidence!: number;

  @ApiProperty({ description: 'Confidence tier: low, medium, or high' })
  @IsString()
  readonly overallConfidenceTier!: ConfidenceTier;

  @ApiProperty({ description: 'Filename of the resume used (e.g., backend.md)' })
  @IsString()
  readonly resumeUsed!: string;

  @ApiProperty({ description: 'How the resume was selected' })
  @IsString()
  readonly resumeSelectionReason!: ResumeSelectionReason;

  @ApiProperty({ description: 'ISO 8601 timestamp of generation' })
  @IsDateString()
  readonly generatedAt!: string;

  @ApiProperty({ description: 'Token usage and cost for this generation', type: () => TokenUsageDto })
  @ValidateNested()
  @Type(() => TokenUsageDto)
  readonly tokenUsage!: TokenUsageDto;
}