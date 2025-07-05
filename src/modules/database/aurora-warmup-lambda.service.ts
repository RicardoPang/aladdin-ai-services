/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  Injectable,
  OnModuleInit,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuroraWarmupLambdaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AuroraWarmupLambdaService.name);
  private warmupInterval: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // 应用启动时预热数据库
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

    // 在Lambda环境中，设置一个保活机制
    // 注意：Lambda有执行时间限制，这个interval应该适度
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      this.logger.log('🔧 Lambda环境检测到，启用轻量级保活机制');
      // Lambda中使用更短的间隔，因为Lambda实例可能会频繁冷启动
      this.startKeepalive();
    }
  }

  onModuleDestroy() {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
  }

  private startKeepalive() {
    // 在Lambda中，我们可以使用较短的间隔来保持连接活跃
    // 但要注意不要过度使用，因为Lambda有执行时间限制
    this.warmupInterval = setInterval(async () => {
      try {
        await this.keepAlive();
      } catch (error) {
        this.logger.warn(
          '⚠️ 保活失败，忽略错误',
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    }, 30000); // 30秒间隔，比原来的5分钟更频繁但适合Lambda
  }

  // 数据库保活
  async keepAlive() {
    try {
      // 同时测试读写数据库
      await Promise.all([
        this.prisma.getWriterClient().$queryRaw`SELECT 1 as writer_heartbeat`,
        this.prisma.getReaderClient().$queryRaw`SELECT 1 as reader_heartbeat`,
      ]);

      this.logger.log('🔥 数据库保活成功 (读写库)');
      return true;
    } catch (error) {
      this.logger.warn(
        '⚠️ 数据库保活失败，将触发重新预热',
        error instanceof Error ? error.message : 'Unknown error',
      );

      // 保活失败时，尝试重新预热
      this.executeWithRetry(() => this.warmupDatabase(), 2, 5000).catch((e) =>
        this.logger.error(
          '重试预热失败',
          e instanceof Error ? e.message : 'Unknown error',
        ),
      );
      throw error;
    }
  }

  async warmupDatabase() {
    try {
      this.logger.log('🚀 开始预热数据库...');
      const start = Date.now();

      // 预热写库和读库
      await Promise.all([
        this.prisma.getWriterClient()
          .$queryRaw`SELECT NOW() as writer_time, pg_backend_pid() as writer_pid`,
        this.prisma.getReaderClient()
          .$queryRaw`SELECT NOW() as reader_time, pg_backend_pid() as reader_pid`,
      ]);

      const duration = Date.now() - start;
      this.logger.log(`✅ 数据库预热完成 (读写库)，耗时: ${duration}ms`);
      return true;
    } catch (error) {
      this.logger.error(
        '❌ 数据库预热失败:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  // 手动触发预热 - 可以通过API调用
  async manualWarmup(): Promise<{
    success: boolean;
    duration: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.warmupDatabase();
      return {
        success: true,
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // 重试机制
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

        // 重试时等待时间递增
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt),
        );
      }
    }
    throw new Error('操作重试失败');
  }
}
