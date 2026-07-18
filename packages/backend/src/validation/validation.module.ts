import { Module } from '@nestjs/common';
import { PiiFilterService } from './pii-filter.service';
import { ResponseValidatorService } from './response-validator.service';

@Module({
  providers: [PiiFilterService, ResponseValidatorService],
  exports: [PiiFilterService, ResponseValidatorService],
})
export class ValidationModule {}