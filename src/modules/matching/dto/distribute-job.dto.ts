import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DistributeJobDto {
  @ApiProperty({ description: '要分发的Job ID' })
  @IsString()
  jobId: string;
}
