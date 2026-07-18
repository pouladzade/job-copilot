import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';
import { LlmModule } from '../llm/llm.module';
import { ResumeModule } from '../resume/resume.module';
import { PromptsModule } from '../prompts/prompts.module';
import { ValidationModule } from '../validation/validation.module';
import { Application } from '../database/entities/application.entity';
import { TokenUsageLog } from '../database/entities/token-usage-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application, TokenUsageLog]),
    LlmModule,
    ResumeModule,
    PromptsModule,
    ValidationModule,
  ],
  controllers: [ApplicationController],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}