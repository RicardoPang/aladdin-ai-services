import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuroraWarmupLambdaService } from './aurora-warmup-lambda.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly warmupService: AuroraWarmupLambdaService,
  ) {}

  @Get('database')
  async checkDatabase() {
    const connectionStatus = this.prismaService.getConnectionStatus();

    const results = {
      timestamp: new Date().toISOString(),
      status: connectionStatus.isHealthy ? 'healthy' : 'unhealthy',
      connections: connectionStatus,
      tests: {
        writer: null as any,
        reader: null as any,
      },
    };

    try {
      await this.prismaService.getWriterClient()
        .$queryRaw`SELECT 1 as writer_test`;
      results.tests.writer = { status: 'success', message: '写数据库连接正常' };
    } catch (error) {
      results.tests.writer = {
        status: 'error',
        message: '写数据库连接失败',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }

    try {
      await this.prismaService.getReaderClient()
        .$queryRaw`SELECT 1 as reader_test`;
      results.tests.reader = { status: 'success', message: '读数据库连接正常' };
    } catch (error) {
      results.tests.reader = {
        status: 'error',
        message: '读数据库连接失败',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }

    return results;
  }

  @Get('database/connections')
  checkConnections() {
    return {
      timestamp: new Date().toISOString(),
      connections: this.prismaService.getConnectionStatus(),
    };
  }

  @Get('database/test-split')
  async testReadWriteSplit() {
    const timestamp = new Date().toISOString();
    const testId = `test_${Date.now()}`;

    const results = {
      timestamp,
      testId,
      writeTest: null as any,
      readTest: null as any,
      splitVerification: {
        writerUrl: null as string | null,
        readerUrl: null as string | null,
        isDifferent: false,
        writerInfo: null as any,
        readerInfo: null as any,
        error: null as string | null,
      },
    };

    try {
      const writeStart = Date.now();
      await this.prismaService.getWriterClient().$queryRaw`
        SELECT 
          'writer_test' as source,
          ${testId} as test_id,
          NOW() as timestamp,
          pg_backend_pid() as connection_id,
          current_database() as database_name,
          inet_server_addr() as server_ip,
          inet_server_port() as server_port
      `;
      const writeDuration = Date.now() - writeStart;

      results.writeTest = {
        status: 'success',
        duration: writeDuration,
        message: '写数据库连接测试成功',
      };
    } catch (error) {
      results.writeTest = {
        status: 'error',
        message: '写数据库连接测试失败',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }

    try {
      const readStart = Date.now();
      const readResult = await this.prismaService.getReaderClient().$queryRaw`
        SELECT 
          'reader_test' as source,
          ${testId} as test_id,
          NOW() as timestamp,
          pg_backend_pid() as connection_id,
          current_database() as database_name,
          inet_server_addr() as server_ip,
          inet_server_port() as server_port
      `;
      const readDuration = Date.now() - readStart;

      results.readTest = {
        status: 'success',
        duration: readDuration,
        message: '读数据库连接测试成功',
        connectionInfo: (readResult as any)[0],
      };
    } catch (error) {
      results.readTest = {
        status: 'error',
        message: '读数据库连接测试失败',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }

    try {
      // 获取写库连接信息
      const writerInfo = await this.prismaService.getWriterClient().$queryRaw`
        SELECT 
          inet_server_addr() as server_ip,
          inet_server_port() as server_port,
          current_database() as database_name
      `;

      // 获取读库连接信息
      const readerInfo = await this.prismaService.getReaderClient().$queryRaw`
        SELECT 
          inet_server_addr() as server_ip,
          inet_server_port() as server_port,
          current_database() as database_name
      `;

      const writerEndpoint = `${(writerInfo as any)[0]?.server_ip}:${(writerInfo as any)[0]?.server_port}`;
      const readerEndpoint = `${(readerInfo as any)[0]?.server_ip}:${(readerInfo as any)[0]?.server_port}`;

      results.splitVerification = {
        writerUrl: writerEndpoint,
        readerUrl: readerEndpoint,
        isDifferent: writerEndpoint !== readerEndpoint,
        writerInfo: (writerInfo as any)[0],
        readerInfo: (readerInfo as any)[0],
        error: null,
      };
    } catch (error) {
      results.splitVerification.writerUrl = 'error';
      results.splitVerification.readerUrl = 'error';
      results.splitVerification.isDifferent = false;
      results.splitVerification.error =
        error instanceof Error ? error.message : '未知错误';
    }

    return results;
  }

  @Get('database/performance')
  async testPerformance() {
    const iterations = 10;
    const results = {
      timestamp: new Date().toISOString(),
      iterations,
      writerPerformance: {
        totalTime: 0,
        averageTime: 0,
        results: [] as number[],
      },
      readerPerformance: {
        totalTime: 0,
        averageTime: 0,
        results: [] as number[],
      },
    };

    for (let i = 0; i < iterations; i++) {
      try {
        const start = Date.now();
        await this.prismaService.getWriterClient().$queryRaw`SELECT 1`;
        const duration = Date.now() - start;
        results.writerPerformance.results.push(duration);
        results.writerPerformance.totalTime += duration;
      } catch {
        results.writerPerformance.results.push(-1);
      }
    }

    for (let i = 0; i < iterations; i++) {
      try {
        const start = Date.now();
        await this.prismaService.getReaderClient().$queryRaw`SELECT 1`;
        const duration = Date.now() - start;
        results.readerPerformance.results.push(duration);
        results.readerPerformance.totalTime += duration;
      } catch {
        results.readerPerformance.results.push(-1);
      }
    }

    const validWriterResults = results.writerPerformance.results.filter(
      (r) => r > 0,
    );
    const validReaderResults = results.readerPerformance.results.filter(
      (r) => r > 0,
    );

    results.writerPerformance.averageTime =
      validWriterResults.length > 0
        ? validWriterResults.reduce((a, b) => a + b, 0) /
          validWriterResults.length
        : 0;

    results.readerPerformance.averageTime =
      validReaderResults.length > 0
        ? validReaderResults.reduce((a, b) => a + b, 0) /
          validReaderResults.length
        : 0;

    return results;
  }

  @Get('database/warmup')
  async warmupDatabase() {
    const result = await this.warmupService.manualWarmup();
    return {
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  @Get('database/keepalive')
  async keepAlive() {
    const start = Date.now();
    try {
      await this.warmupService.keepAlive();
      return {
        timestamp: new Date().toISOString(),
        status: 'success',
        duration: Date.now() - start,
        message: '数据库保活成功',
      };
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        status: 'error',
        duration: Date.now() - start,
        message: '数据库保活失败',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }
}
