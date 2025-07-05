import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import * as dotenv from "dotenv";

// 环境变量
const env = process.env.NODE_ENV || 'development';
console.log(`当前NODE_ENV: ${env}`);

const originalDbUrl = process.env.DATABASE_URL;

dotenv.config({ path: `.env.${env}` });
const dbUrl = process.env.DATABASE_URL || '';
console.log(`加载的环境文件: .env.${env}`);

const dbUrlObj = new URL(dbUrl);
const isProduction = dbUrlObj.hostname.includes('pf-ai-bff') || dbUrlObj.hostname.includes('rds.amazonaws.com');
const dbEnv = isProduction ? '生产环境' : '开发环境';
const dbName = dbUrlObj.pathname.split('/')[1].split('?')[0];

console.log(`=================================================`);
console.log(`🔴 数据库环境: ${dbEnv}`);
console.log(`🔴 数据库主机: ${dbUrlObj.hostname}`);
console.log(`🔴 数据库名称: ${dbName}`);
console.log(`=================================================`);

if (originalDbUrl && originalDbUrl !== process.env.DATABASE_URL) {
  console.log('⚠️ 警告：环境文件覆盖了命令行设置的DATABASE_URL');
}

export class EnhancedPrismaClient extends PrismaClient {
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private readonly logger = console;
  private isConnected = false;
  private readonly env: string;

  constructor(options?: any) {
    super(options);
    this.env = env;
    this.logger.log(chalk.blue(`当前环境：${this.env}`));
  }

  async connectWithRetry(maxRetries = 5, retryDelay = 3000): Promise<boolean> {
    const dbType = this.env === 'production' ? 'AWS Aurora' : '本地';
    this.logger.log(chalk.blue(`🔌 尝试连接到${dbType}数据库...`));

    // 开发环境减少重试
    const actualMaxRetries = this.env === 'production' ? maxRetries : 2;

    for (let attempt = 1; attempt <= actualMaxRetries; attempt++) {
      try {
        await this.$connect();
        this.isConnected = true;
        this.logger.log(chalk.green('✅ 数据库连接成功！'));

        // 启动保活机制
        this.startKeepAlive();

        return true;
      } catch (error) {
        if (attempt === actualMaxRetries) {
          this.logger.error(
            chalk.red(`❌ 数据库连接失败 (${attempt}/${actualMaxRetries}):`),
            error instanceof Error ? error.message : '未知错误',
          );
          return false;
        }

        this.logger.warn(
          chalk.yellow(
            `⚠️ 连接尝试 ${attempt}/${actualMaxRetries} 失败，${retryDelay / 1000}秒后重试...`,
          ),
          error instanceof Error ? error.message : '未知错误',
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    return false;
  }

  startKeepAlive(intervalMs = 5 * 60 * 1000) {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.logger.log(
      chalk.blue(`🔄 启动数据库保活机制 (每${intervalMs / 60000}分钟)`),
    );

    this.keepAliveInterval = setInterval(async () => {
      if (!this.isConnected) return;

      try {
        await this.$queryRaw`SELECT 1 as heartbeat`;
        this.logger.log(chalk.blue('💓 数据库保活心跳成功'));
      } catch (error) {
        this.logger.warn(
          chalk.yellow('⚠️ 数据库保活失败，尝试重新连接...'),
          error instanceof Error ? error.message : '未知错误',
        );

        // 重新连接
        this.isConnected = false;
        this.connectWithRetry().catch(() => {});
      }
    }, intervalMs);
  }

  async disconnect() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.isConnected) {
      await this.$disconnect();
      this.isConnected = false;
      this.logger.log(chalk.blue('🔌 数据库连接已断开'));
    }
  }
}

export const createEnhancedPrismaClient = async (
  options?: any,
): Promise<EnhancedPrismaClient | null> => {
  const client = new EnhancedPrismaClient(options);
  const connected = await client.connectWithRetry();

  if (!connected) {
    await client.disconnect();
    return null;
  }

  return client;
};
