import { Global, Module } from '@nestjs/common';
// import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
// import { AuroraWarmupService } from './aurora-warmup.service';
import { AuroraWarmupLambdaService } from './aurora-warmup-lambda.service';
import { HealthController } from './health.controller';

@Global()
@Module({
  imports: [
    // ScheduleModule.forRoot()
  ],
  controllers: [HealthController],
  providers: [PrismaService, AuroraWarmupLambdaService],
  exports: [PrismaService, AuroraWarmupLambdaService],
})
export class DatabaseModule {}
