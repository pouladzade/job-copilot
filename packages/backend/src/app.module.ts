import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ApplicationModule } from './application/application.module';
import { DeepseekModule } from './deepseek/deepseek.module';
import { ResumeModule } from './resume/resume.module';
import { PromptsModule } from './prompts/prompts.module';
import { ValidationModule } from './validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ApplicationModule,
    DeepseekModule,
    ResumeModule,
    PromptsModule,
    ValidationModule,
  ],
})
export class AppModule {}