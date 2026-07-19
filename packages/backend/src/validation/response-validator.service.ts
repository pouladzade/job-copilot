import { Injectable } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ApplicationDraftDto } from '@job-hunter/shared';

export interface ValidationResult {
  valid: boolean;
  draft?: ApplicationDraftDto;
  errors: string[];
}

@Injectable()
export class ResponseValidatorService {
  async validate(jsonContent: string): Promise<ValidationResult> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonContent) as unknown;
    } catch {
      return { valid: false, errors: ['Failed to parse JSON from DeepSeek response'] };
    }

    const draft = plainToInstance(ApplicationDraftDto, parsed as object) as ApplicationDraftDto;
    const validationErrors: ValidationError[] = await validate(draft);

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map((err) => {
        const constraints = err.constraints;
        const messages = constraints !== undefined ? Object.values(constraints).join(', ') : 'unknown validation error';

        return `${err.property}: ${messages}`;
      });

      return { valid: false, errors: errorMessages };
    }

    return { valid: true, draft, errors: [] };
  }
}