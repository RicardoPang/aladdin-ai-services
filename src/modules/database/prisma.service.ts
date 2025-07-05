import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isWriterConnected = false;
  private isReaderConnected = false;
  private readonly env: string;

  // 写数据库客户端
  public readonly writerClient: PrismaClient;
  // 读数据库客户端
  public readonly readerClient: PrismaClient;

  constructor(private configService: ConfigService) {
    this.env = configService.get<string>('NODE_ENV') || 'development';
    this.logger.log(`当前环境：${this.env}`);

    // 初始化写数据库客户端
    this.writerClient = new PrismaClient({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
      log: ['error', 'warn'],
    });

    // 初始化读数据库客户端
    const readerUrl = configService.get<string>('DATABASE_URL_READER');
    this.readerClient = new PrismaClient({
      datasources: {
        db: {
          url: readerUrl || configService.get<string>('DATABASE_URL'), // 如果没有配置读库，使用写库
        },
      },
      log: ['error', 'warn'],
    });

    this.logger.log(
      `写数据库配置：${this.maskUrl(configService.get<string>('DATABASE_URL') || '')}`,
    );
    this.logger.log(
      `读数据库配置：${this.maskUrl(readerUrl || configService.get<string>('DATABASE_URL') || '')}`,
    );
  }

  // 掩码URL
  private maskUrl(url: string): string {
    if (!url) return 'undefined';
    return url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  }

  async onModuleInit() {
    this.logger.log('🚀 初始化 PrismaService，尝试连接数据库（读写分离）...');

    // 并行连接读写数据库
    const [writerConnected, readerConnected] = await Promise.all([
      this.connectWriterWithRetry(),
      this.connectReaderWithRetry(),
    ]);

    if (!writerConnected || !readerConnected) {
      this.logger.error('❌ 数据库连接失败，应用可能无法正常工作');
    }

    // 只在生产环境启用保活机制
    if (this.env === 'production') {
      this.startKeepAlive();
      this.logger.log('🔄 生产环境：已启用数据库保活机制');
    } else {
      this.logger.log('🔄 开发环境：无需启用数据库保活机制');
    }
  }

  async onModuleDestroy() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    // 断开读写数据库连接
    await Promise.all([
      this.writerClient.$disconnect(),
      this.readerClient.$disconnect(),
    ]);

    this.isWriterConnected = false;
    this.isReaderConnected = false;
    this.logger.log('🔌 读写数据库连接已断开');
  }

  async testConnect() {
    try {
      await Promise.all([
        this.writerClient.$connect(),
        this.readerClient.$connect(),
      ]);

      this.isWriterConnected = true;
      this.isReaderConnected = true;
      this.logger.log('✅ 读写数据库连接成功');
      return true;
    } catch (error) {
      this.logger.error(
        '❌ 数据库连接失败:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }

  async connectWriterWithRetry(
    maxRetries = 5,
    retryDelay = 3000,
  ): Promise<boolean> {
    this.logger.log(
      `🔌 尝试连接到${this.env === 'production' ? 'AWS Aurora' : '本地'}写数据库...`,
    );

    const actualMaxRetries = this.env === 'production' ? maxRetries : 2;

    for (let attempt = 1; attempt <= actualMaxRetries; attempt++) {
      try {
        await this.writerClient.$connect();
        this.isWriterConnected = true;
        this.logger.log('✅ 写数据库连接成功！');
        return true;
      } catch (error) {
        if (attempt === actualMaxRetries) {
          this.logger.error(
            `❌ 写数据库连接失败 (${attempt}/${actualMaxRetries}):`,
            error instanceof Error ? error.message : '未知错误',
          );
          return false;
        }

        this.logger.warn(
          `⚠️ 写数据库连接尝试 ${attempt}/${actualMaxRetries} 失败，${retryDelay / 1000}秒后重试...`,
          error instanceof Error ? error.message : '未知错误',
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    return false;
  }

  async connectReaderWithRetry(
    maxRetries = 5,
    retryDelay = 3000,
  ): Promise<boolean> {
    this.logger.log(
      `🔌 尝试连接到${this.env === 'production' ? 'AWS Aurora' : '本地'}读数据库...`,
    );

    const actualMaxRetries = this.env === 'production' ? maxRetries : 2;

    for (let attempt = 1; attempt <= actualMaxRetries; attempt++) {
      try {
        await this.readerClient.$connect();
        this.isReaderConnected = true;
        this.logger.log('✅ 读数据库连接成功！');
        return true;
      } catch (error) {
        if (attempt === actualMaxRetries) {
          this.logger.error(
            `❌ 读数据库连接失败 (${attempt}/${actualMaxRetries}):`,
            error instanceof Error ? error.message : '未知错误',
          );
          return false;
        }

        this.logger.warn(
          `⚠️ 读数据库连接尝试 ${attempt}/${actualMaxRetries} 失败，${retryDelay / 1000}秒后重试...`,
          error instanceof Error ? error.message : '未知错误',
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    return false;
  }

  private async doHeartbeat() {
    if (!this.isWriterConnected && !this.isReaderConnected) return;

    // 并行进行读写数据库心跳检测
    const promises: Promise<{
      type: 'writer' | 'reader';
      success: boolean;
      error?: any;
    }>[] = [];

    if (this.isWriterConnected) {
      promises.push(
        this.writerClient.$queryRaw`SELECT 1 as heartbeat_writer`
          .then(() => ({ type: 'writer' as const, success: true }))
          .catch((error) => ({
            type: 'writer' as const,
            success: false,
            error,
          })),
      );
    }

    if (this.isReaderConnected) {
      promises.push(
        this.readerClient.$queryRaw`SELECT 1 as heartbeat_reader`
          .then(() => ({ type: 'reader' as const, success: true }))
          .catch((error) => ({
            type: 'reader' as const,
            success: false,
            error,
          })),
      );
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      if (result.success) {
        this.logger.log(
          `💓 ${result.type === 'writer' ? '写' : '读'}数据库保活心跳成功`,
        );
      } else {
        this.logger.warn(
          `⚠️ ${result.type === 'writer' ? '写' : '读'}数据库保活失败，尝试重新连接...`,
          result.error instanceof Error ? result.error.message : '未知错误',
        );

        if (result.type === 'writer') {
          this.isWriterConnected = false;
          this.connectWriterWithRetry().catch(() => {});
        } else {
          this.isReaderConnected = false;
          this.connectReaderWithRetry().catch(() => {});
        }
      }
    }
  }

  startKeepAlive(intervalMs = 5 * 60 * 1000) {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.logger.log(`🔄 启动数据库保活机制 (每${intervalMs / 60000}分钟)`);

    this.keepAliveInterval = setInterval(() => {
      this.doHeartbeat().catch((err) => {
        this.logger.error(
          '心跳执行出错:',
          err instanceof Error ? err.message : '未知错误',
        );
      });
    }, intervalMs);
  }

  // 获取写数据库客户端（用于增删改操作）
  getWriterClient(): PrismaClient {
    return this.writerClient;
  }

  // 获取读数据库客户端（用于查询操作）
  getReaderClient(): PrismaClient {
    return this.readerClient;
  }

  // 便捷方法：根据操作类型自动选择客户端
  getClient(operation: 'read' | 'write' = 'read'): PrismaClient {
    return operation === 'write' ? this.writerClient : this.readerClient;
  }

  // 检查连接状态
  getConnectionStatus() {
    return {
      writer: this.isWriterConnected,
      reader: this.isReaderConnected,
      isHealthy: this.isWriterConnected && this.isReaderConnected,
    };
  }
}
