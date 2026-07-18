import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject } from 'class-validator';

export class ResumeIndexResponseDto {
  @ApiProperty({ description: 'Human-readable status message' })
  readonly message!: string;

  @ApiProperty({ description: 'Map of resume filename to generated tags' })
  @IsObject()
  readonly tags!: Record<string, string[]>;

  @ApiProperty({ description: 'Token usage for the index refresh call' })
  @IsObject()
  readonly tokenUsage!: {
    readonly totalTokens: number;
    readonly estimatedCostUsd: number;
  };
}