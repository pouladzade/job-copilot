import { Module } from '@nestjs/common';
import { ResumeLoaderService } from './resume-loader.service';
import { ProfileMergeService } from './profile-merge.service';
import { ResumeIndexService } from './resume-index.service';
import { ResumeController } from './resume.controller';
import { DeepseekModule } from '../deepseek/deepseek.module';

@Module({
  imports: [DeepseekModule],
  controllers: [ResumeController],
  providers: [ResumeLoaderService, ProfileMergeService, ResumeIndexService],
  exports: [ResumeLoaderService, ProfileMergeService, ResumeIndexService],
})
export class ResumeModule {}