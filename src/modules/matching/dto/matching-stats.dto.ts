import { ApiProperty } from '@nestjs/swagger';

export class MatchingStatsDto {
  @ApiProperty({ description: '总分发任务数' })
  totalDistributions: number;

  @ApiProperty({ description: '成功分发数' })
  successfulDistributions: number;

  @ApiProperty({ description: '失败分发数' })
  failedDistributions: number;

  @ApiProperty({ description: '平均匹配Agent数量' })
  averageAgentsPerJob: number;

  @ApiProperty({ description: '最近24小时分发数' })
  last24HoursDistributions: number;

  @ApiProperty({ description: '成功率百分比' })
  successRate: number;
}
