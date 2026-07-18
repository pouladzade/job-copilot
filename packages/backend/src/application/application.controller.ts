import { Controller, Get, Post, Patch, Body, Query, Param, HttpCode, HttpStatus, Inject, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  JobPostingDto,
  ApplicationDraftDto,
  SaveApplicationDto,
  ListApplicationsQueryDto,
  ListApplicationsResponseDto,
} from '@job-hunter/shared';
import { ApplicationService } from './application.service';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('applications')
@Controller('applications')
export class ApplicationController {
  constructor(@Inject(ApplicationService) private readonly applicationService: ApplicationService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Backend is running' })
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate tailored application content from a job posting' })
  @ApiResponse({ status: 201, description: 'Application draft generated', type: ApplicationDraftDto })
  @ApiResponse({ status: 400, description: 'Invalid job posting data' })
  @ApiResponse({ status: 409, description: 'Application already exists for this URL' })
  @ApiResponse({ status: 502, description: 'DeepSeek returned invalid JSON' })
  @ApiResponse({ status: 503, description: 'DeepSeek API unavailable' })
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() jobPosting: JobPostingDto): Promise<ApplicationDraftDto> {
    return this.applicationService.generate(jobPosting);
  }

  @Post(':id/save')
  @ApiOperation({ summary: 'Save user-edited application draft' })
  @ApiResponse({ status: 200, description: 'Application saved' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @HttpCode(HttpStatus.OK)
  async save(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveApplicationDto,
  ): Promise<{ id: number; savedAt: string }> {
    return this.applicationService.update(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List applications with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of applications', type: ListApplicationsResponseDto })
  @HttpCode(HttpStatus.OK)
  async list(@Query() query: ListApplicationsQueryDto): Promise<ListApplicationsResponseDto> {
    return this.applicationService.list(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update application status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ): Promise<{ id: number; status: string }> {
    return this.applicationService.updateStatus(id, dto.status);
  }
}