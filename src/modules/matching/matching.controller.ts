import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import { DistributeJobDto } from './dto/distribute-job.dto';
import { DistributionResultDto } from './dto/distribution-result.dto';
import { MatchingStatsDto } from './dto/matching-stats.dto';

@ApiTags('任务匹配')
@Controller('matching')
export class MatchingController {
  private readonly logger = new Logger(MatchingController.name);

  constructor(private readonly matchingService: MatchingService) {}

  @Post('distribute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '分发任务给匹配的Agent' })
  @ApiResponse({
    status: 200,
    description: '任务分发成功',
    type: DistributionResultDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Job不存在或状态不正确',
  })
  @ApiResponse({
    status: 500,
    description: '分发过程中发生错误',
  })
  async distributeJob(
    @Body() distributeJobDto: DistributeJobDto,
  ): Promise<DistributionResultDto> {
    this.logger.log(`收到任务分发请求: ${distributeJobDto.jobId}`);

    try {
      const result = await this.matchingService.distributeJob(
        distributeJobDto.jobId,
      );
      this.logger.log(`任务 ${distributeJobDto.jobId} 分发成功`);
      return result;
    } catch (error) {
      this.logger.error(
        `任务 ${distributeJobDto.jobId} 分发失败: ${error.message}`,
      );
      throw error;
    }
  }

  @Get('stats')
  @ApiOperation({ summary: '获取匹配统计信息' })
  @ApiResponse({
    status: 200,
    description: '获取统计信息成功',
    type: MatchingStatsDto,
  })
  getMatchingStats(): MatchingStatsDto {
    this.logger.log('获取匹配统计信息');

    // TODO: 实现统计信息获取逻辑
    return {
      totalDistributions: 0,
      successfulDistributions: 0,
      failedDistributions: 0,
      averageAgentsPerJob: 0,
      last24HoursDistributions: 0,
      successRate: 0,
    };
  }
}
