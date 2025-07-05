import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuroraWarmupService implements OnModuleInit {
  private readonly logger = new Logger(AuroraWarmupService.name);

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // 应用启动 预热数据库 - 不阻塞应用启动
    this.warmupDatabase().catch((error) => {
      this.logger.error(
        '❌ 应用启动时数据库预热失败，将在后台重试',
        error instanceof Error ? error.message : 'Unknown error',
      );
      // 延迟重试
      setTimeout(() => {
        this.executeWithRetry(() => this.warmupDatabase(), 3, 10000).catch(
          (e) =>
            this.logger.error(
              '数据库预热重试失败',
              e instanceof Error ? e.message : 'Unknown error',
            ),
        );
      }, 5000);
    });
  }

  // 每5分钟激活 防止休眠
  @Cron(CronExpression.EVERY_5_MINUTES)
  async keepAlive() {
    try {
      await this.prisma.getWriterClient().$queryRaw`SELECT 1 as heartbeat`;
      this.logger.log('🔥 数据库保活成功');
    } catch (error) {
      this.logger.warn(
        '⚠️ 数据库保活失败，将在下次请求时重试',
        error instanceof Error ? error.message : 'Unknown error',
      );
      this.executeWithRetry(() => this.warmupDatabase(), 2, 5000).catch((e) =>
        this.logger.error(
          '重试预热失败',
          e instanceof Error ? e.message : 'Unknown error',
        ),
      );
    }
  }

  async warmupDatabase() {
    try {
      this.logger.log('🚀 开始预热数据库...');
      const start = Date.now();

      await this.prisma.getWriterClient()
        .$queryRaw`SELECT NOW() as server_time`;

      const duration = Date.now() - start;
      this.logger.log(`✅ 数据库预热完成，耗时: ${duration}ms`);
      return true;
    } catch (error) {
      this.logger.error(
        '❌ 数据库预热失败:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  // 重试
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    retryDelay = 3000,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `🔄 操作失败，重试第${attempt}次...`,
          error instanceof Error ? error.message : 'Unknown error',
        );

        // 重试时等待时间增加
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt),
        );
      }
    }
    throw new Error('操作重试失败');
  }
}
