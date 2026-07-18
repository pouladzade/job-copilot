import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationDraftDto } from './application-draft.dto';

export class GenerateResponseDto {
  @ValidateNested()
  @Type(() => ApplicationDraftDto)
  readonly draft!: ApplicationDraftDto;
}