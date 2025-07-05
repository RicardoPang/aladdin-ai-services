import { ApiProperty } from '@nestjs/swagger';

export class AgentSummaryDto {
  @ApiProperty({ description: 'Agent ID' })
  id: string;

  @ApiProperty({ description: 'Agent 名称' })
  name: string;
}

export class DistributionResultDto {
  @ApiProperty({ description: '分发是否成功' })
  success: boolean;

  @ApiProperty({ description: '分发记录ID' })
  distributionId: string;

  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: '分发的Agent数量' })
  agentsCount: number;

  @ApiProperty({
    description: '分发的Agent列表',
    type: [AgentSummaryDto],
  })
  agents: AgentSummaryDto[];

  @ApiProperty({ description: '分发时间' })
  distributedAt?: Date;

  @ApiProperty({ description: '错误信息（如果失败）' })
  error?: string;
}
