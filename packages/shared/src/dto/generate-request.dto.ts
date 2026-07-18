import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JobPostingDto } from './job-posting.dto';

export class GenerateRequestDto {
  @ValidateNested()
  @Type(() => JobPostingDto)
  readonly jobPosting!: JobPostingDto;
}