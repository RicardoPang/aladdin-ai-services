#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseConnectionString(url) {
  if (!url) return null;
  
  try {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (match) {
      const [, user, password, host, port, dbWithParams] = match;
      const [database, params] = dbWithParams.split('?');
      
      const config = {
        user,
        password,
        host,
        port: parseInt(port),
        database,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 5000,
      };
      
      // 解析额外参数
      if (params) {
        const paramPairs = params.split('&');
        paramPairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key === 'sslmode') {
            config.ssl = value !== 'disable';
          } else if (key === 'connect_timeout') {
            config.connectionTimeoutMillis = parseInt(value) * 1000;
          }
        });
      }
      
      return config;
    }
  } catch (error) {
    log('red', `解析连接字符串失败: ${error.message}`);
  }
  return null;
}

async function testConnection(config, label) {
  log('blue', `\\n🔗 测试${label}连接...`);
  log('cyan', `   主机: ${config.host}:${config.port}`);
  log('cyan', `   数据库: ${config.database}`);
  log('cyan', `   用户: ${config.user}`);
  
  const client = new Client(config);
  
  try {
    const startTime = Date.now();
    
    // 连接数据库
    await client.connect();
    const connectTime = Date.now() - startTime;
    log('green', `✅ ${label}连接成功 (${connectTime}ms)`);
    
    // 执行测试查询
    const queryStart = Date.now();
    const result = await client.query(`
      SELECT 
        '${label}' as source,
        NOW() as timestamp,
        pg_backend_pid() as connection_id,
        current_database() as database_name,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port,
        version() as postgres_version
    `);
    const queryTime = Date.now() - queryStart;
    
    log('green', `✅ ${label}查询成功 (${queryTime}ms)`);
    
    const row = result.rows[0];
    log('cyan', `   服务器IP: ${row.server_ip}`);
    log('cyan', `   服务器端口: ${row.server_port}`);
    log('cyan', `   连接ID: ${row.connection_id}`);
    log('cyan', `   时间戳: ${row.timestamp}`);
    
    return {
      success: true,
      connectTime,
      queryTime,
      serverInfo: row
    };
    
  } catch (error) {
    log('red', `❌ ${label}连接失败: ${error.message}`);
    
    // 分析错误类型
    if (error.code === 'ENOTFOUND') {
      log('yellow', '   💡 DNS解析失败 - 检查主机名是否正确');
    } else if (error.code === 'ECONNREFUSED') {
      log('yellow', '   💡 连接被拒绝 - 检查端口和防火墙设置');
    } else if (error.code === 'ETIMEDOUT') {
      log('yellow', '   💡 连接超时 - 检查网络连通性和安全组设置');
    } else if (error.message.includes('password authentication failed')) {
      log('yellow', '   💡 认证失败 - 检查用户名和密码');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      log('yellow', '   💡 数据库不存在 - 检查数据库名称');
    } else if (error.message.includes('SSL')) {
      log('yellow', '   💡 SSL配置问题 - 检查SSL设置');
    }
    
    return {
      success: false,
      error: error.message,
      code: error.code
    };
    
  } finally {
    try {
      await client.end();
    } catch (endError) {
      // 忽略断开连接的错误
    }
  }
}

async function compareConnections(writerResult, readerResult) {
  log('cyan', '\\n📊 连接对比分析:');
  
  if (writerResult.success && readerResult.success) {
    const writerInfo = writerResult.serverInfo;
    const readerInfo = readerResult.serverInfo;
    
    log('blue', '\\n🔍 服务器信息对比:');
    log('cyan', `写库服务器: ${writerInfo.server_ip}:${writerInfo.server_port}`);
    log('cyan', `读库服务器: ${readerInfo.server_ip}:${readerInfo.server_port}`);
    
    const isDifferent = writerInfo.server_ip !== readerInfo.server_ip || 
                       writerInfo.server_port !== readerInfo.server_port;
    
    if (isDifferent) {
      log('green', '✅ 读写分离配置正确 - 使用不同的服务器');
    } else {
      log('yellow', '⚠️  读写使用相同服务器 - 可能未正确配置读写分离');
    }
    
    log('blue', '\\n⏱️  性能对比:');
    log('cyan', `写库连接时间: ${writerResult.connectTime}ms`);
    log('cyan', `读库连接时间: ${readerResult.connectTime}ms`);
    log('cyan', `写库查询时间: ${writerResult.queryTime}ms`);
    log('cyan', `读库查询时间: ${readerResult.queryTime}ms`);
    
    const avgWriterTime = (writerResult.connectTime + writerResult.queryTime) / 2;
    const avgReaderTime = (readerResult.connectTime + readerResult.queryTime) / 2;
    
    if (avgReaderTime < avgWriterTime) {
      log('green', '✅ 读库性能较好');
    } else {
      log('yellow', '⚠️  写库性能更好或相当');
    }
    
  } else {
    log('red', '❌ 无法进行对比分析 - 部分连接失败');
  }
}

async function testPostgresConnection() {
  log('cyan', '🐘 PostgreSQL 连接测试工具');
  log('cyan', '==============================');

  // 读取环境配置
  const envFile = path.join(__dirname, '../.env.production');
  if (!fs.existsSync(envFile)) {
    log('red', '❌ .env.production 文件不存在');
    return;
  }

  const envContent = fs.readFileSync(envFile, 'utf-8');
  const writeDbUrl = envContent.match(/^DATABASE_URL="?([^"\\n]+)"?/m)?.[1];
  const readDbUrl = envContent.match(/^DATABASE_URL_READER="?([^"\\n]+)"?/m)?.[1];

  if (!writeDbUrl) {
    log('red', '❌ DATABASE_URL 未配置');
    return;
  }

  if (!readDbUrl) {
    log('yellow', '⚠️  DATABASE_URL_READER 未配置，将使用写库URL');
  }

  const writerConfig = parseConnectionString(writeDbUrl);
  const readerConfig = parseConnectionString(readDbUrl || writeDbUrl);

  if (!writerConfig || !readerConfig) {
    log('red', '❌ 数据库连接字符串格式错误');
    return;
  }

  // 测试连接
  const writerResult = await testConnection(writerConfig, '写库');
  const readerResult = await testConnection(readerConfig, '读库');

  // 对比分析
  await compareConnections(writerResult, readerResult);

  // 总结
  log('cyan', '\\n📋 测试总结:');
  const writeStatus = writerResult.success ? '✅ 成功' : '❌ 失败';
  const readStatus = readerResult.success ? '✅ 成功' : '❌ 失败';
  
  log('cyan', `写库连接: ${writeStatus}`);
  log('cyan', `读库连接: ${readStatus}`);
  
  if (writerResult.success && readerResult.success) {
    log('green', '\\n🎉 所有连接测试通过！');
  } else {
    log('red', '\\n❌ 部分连接测试失败');
    log('yellow', '\\n💡 故障排查建议:');
    log('cyan', '1. 检查网络连通性: ping <hostname>');
    log('cyan', '2. 检查端口可达性: telnet <hostname> 5432');
    log('cyan', '3. 检查AWS安全组设置');
    log('cyan', '4. 检查RDS实例状态');
    log('cyan', '5. 验证数据库用户权限');
  }
}

// 运行测试
if (require.main === module) {
  testPostgresConnection().catch(error => {
    log('red', `测试失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { testPostgresConnection };