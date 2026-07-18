import { Module } from '@nestjs/common';
import { ResumeLoaderService } from './resume-loader.service';
import { ProfileMergeService } from './profile-merge.service';
import { ResumeIndexService } from './resume-index.service';
import { ResumeController } from './resume.controller';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [ResumeController],
  providers: [ResumeLoaderService, ProfileMergeService, ResumeIndexService],
  exports: [ResumeLoaderService, ProfileMergeService, ResumeIndexService],
})
export class ResumeModule {}