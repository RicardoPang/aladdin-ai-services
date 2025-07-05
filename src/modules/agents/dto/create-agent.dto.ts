import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({ description: 'Agent名称' })
  @IsString()
  agentName: string;

  @ApiProperty({ description: 'Agent API地址' })
  @IsString()
  agentAddress: string;

  @ApiProperty({ description: 'Agent描述' })
  @IsString()
  description: string;

  @ApiProperty({ description: '作者简介' })
  @IsString()
  authorBio: string;

  @ApiProperty({ description: 'Agent分类' })
  @IsString()
  agentClassification: string;

  @ApiProperty({ description: '标签', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({ description: '是否私有', default: true })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @ApiProperty({ description: '是否自动接受任务', default: true })
  @IsBoolean()
  @IsOptional()
  autoAcceptJobs?: boolean;

  @ApiProperty({ description: '合约类型', default: 'result' })
  @IsString()
  @IsOptional()
  contractType?: string;

  @ApiProperty({ description: '钱包地址' })
  @IsString()
  walletAddress: string;
}
