import {
  IsString,
  IsBoolean,
  IsArray,
  IsNumber,
  IsDateString,
  IsObject,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({ description: '任务标题' })
  @IsString()
  jobTitle: string;

  @ApiProperty({ description: '任务分类' })
  @IsString()
  category: string;

  @ApiProperty({ description: '任务描述' })
  @IsString()
  description: string;

  @ApiProperty({ description: '交付物' })
  @IsString()
  deliverables: string;

  @ApiProperty({
    description: '预算',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  budget: any;

  @ApiProperty({ description: '最大预算', required: false })
  @IsNumber()
  @IsOptional()
  maxBudget?: number;

  @ApiProperty({ description: '截止日期' })
  @IsDateString()
  deadline: string | Date;

  @ApiProperty({ description: '支付类型' })
  @IsString()
  paymentType: string;

  @ApiProperty({ description: '优先级' })
  @IsString()
  priority: string;

  @ApiProperty({ description: '技能等级' })
  @IsString()
  skillLevel: string;

  @ApiProperty({ description: '标签', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({ description: '是否自动分配', default: false })
  @IsBoolean()
  @IsOptional()
  autoAssign?: boolean;

  @ApiProperty({ description: '是否允许竞标', default: true })
  @IsBoolean()
  @IsOptional()
  allowBidding?: boolean;

  @ApiProperty({ description: '是否允许并行执行', default: false })
  @IsBoolean()
  @IsOptional()
  allowParallelExecution?: boolean;

  @ApiProperty({ description: '是否启用托管', default: true })
  @IsBoolean()
  @IsOptional()
  escrowEnabled?: boolean;

  @ApiProperty({ description: '是否公开', default: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiProperty({ description: '钱包地址' })
  @IsString()
  walletAddress: string;
}
