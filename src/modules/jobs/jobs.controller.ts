import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiOperation({ summary: '创建新任务' })
  @ApiResponse({ status: 201, description: '任务创建成功' })
  create(@Body() createJobDto: CreateJobDto) {
    return this.jobsService.create(createJobDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有任务' })
  findAll() {
    return this.jobsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取任务' })
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新任务' })
  update(@Param('id') id: string, @Body() updateJobDto: UpdateJobDto) {
    return this.jobsService.update(id, updateJobDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除任务' })
  remove(@Param('id') id: string) {
    return this.jobsService.remove(id);
  }
}
