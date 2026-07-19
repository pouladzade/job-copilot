import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ApplicationModule } from './application/application.module';
import { LlmModule } from './llm/llm.module';
import { ResumeModule } from './resume/resume.module';
import { PromptsModule } from './prompts/prompts.module';
import { ValidationModule } from './validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    ApplicationModule,
    LlmModule,
    ResumeModule,
    PromptsModule,
    ValidationModule,
  ],
})
export class AppModule {}