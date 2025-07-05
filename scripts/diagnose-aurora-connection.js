#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    log('blue', `\n🔍 ${description}...`);
    const result = execSync(command, { encoding: 'utf-8', timeout: 10000 });
    log('green', `✅ ${description}成功`);
    return { success: true, output: result.trim() };
  } catch (error) {
    log('red', `❌ ${description}失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function parseConnectionString(url) {
  if (!url) return null;
  
  try {
    // 解析 postgresql://user:pass@host:port/db
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (match) {
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4]),
        database: match[5].split('?')[0]
      };
    }
  } catch (error) {
    log('red', `解析连接字符串失败: ${error.message}`);
  }
  return null;
}

async function diagnoseAuroraConnection() {
  log('cyan', '🚀 AWS Aurora 连接诊断工具');
  log('white', '=====================================');

  // 读取环境配置
  const envFile = path.join(__dirname, '../.env.production');
  if (!fs.existsSync(envFile)) {
    log('red', '❌ .env.production 文件不存在');
    return;
  }

  const envContent = fs.readFileSync(envFile, 'utf-8');
  const writeDbUrl = envContent.match(/^DATABASE_URL="?([^"\\n]+)"?/m)?.[1];
  const readDbUrl = envContent.match(/^DATABASE_URL_READER="?([^"\\n]+)"?/m)?.[1];

  if (!writeDbUrl || !readDbUrl) {
    log('red', '❌ 数据库连接字符串未配置');
    return;
  }

  const writerConfig = parseConnectionString(writeDbUrl);
  const readerConfig = parseConnectionString(readDbUrl);

  if (!writerConfig || !readerConfig) {
    log('red', '❌ 数据库连接字符串格式错误');
    return;
  }

  log('magenta', '\\n📋 连接配置信息:');
  log('white', `写库主机: ${writerConfig.host}:${writerConfig.port}`);
  log('white', `读库主机: ${readerConfig.host}:${readerConfig.port}`);

  // 1. DNS 解析测试
  log('cyan', '\\n🌐 步骤1: DNS解析测试');
  
  const writerDns = execCommand(`nslookup ${writerConfig.host}`, `解析写库主机 ${writerConfig.host}`);
  const readerDns = execCommand(`nslookup ${readerConfig.host}`, `解析读库主机 ${readerConfig.host}`);

  // 2. 网络连通性测试
  log('cyan', '\\n🔌 步骤2: 网络连通性测试');
  
  const writerPing = execCommand(`ping -c 3 ${writerConfig.host}`, `ping写库主机 ${writerConfig.host}`);
  const readerPing = execCommand(`ping -c 3 ${readerConfig.host}`, `ping读库主机 ${readerConfig.host}`);

  // 3. 端口连通性测试
  log('cyan', '\\n🚪 步骤3: 端口连通性测试');
  
  const writerPort = execCommand(`nc -zv ${writerConfig.host} ${writerConfig.port}`, `测试写库端口 ${writerConfig.host}:${writerConfig.port}`);
  const readerPort = execCommand(`nc -zv ${readerConfig.host} ${readerConfig.port}`, `测试读库端口 ${readerConfig.host}:${readerConfig.port}`);

  // 4. PostgreSQL 连接测试
  log('cyan', '\\n🐘 步骤4: PostgreSQL连接测试');
  
  // 创建临时的 pgpass 文件
  const pgpassContent = `${writerConfig.host}:${writerConfig.port}:${writerConfig.database}:${writerConfig.user}:${writerConfig.password}\\n${readerConfig.host}:${readerConfig.port}:${readerConfig.database}:${readerConfig.user}:${readerConfig.password}`;
  const pgpassFile = path.join(process.env.HOME, '.pgpass_temp');
  
  try {
    fs.writeFileSync(pgpassFile, pgpassContent);
    execSync(`chmod 600 ${pgpassFile}`);
    
    const writerPsql = execCommand(
      `PGPASSFILE=${pgpassFile} psql -h ${writerConfig.host} -p ${writerConfig.port} -U ${writerConfig.user} -d ${writerConfig.database} -c "SELECT 'writer_test' as source, NOW() as timestamp;"`,
      '测试写库PostgreSQL连接'
    );
    
    const readerPsql = execCommand(
      `PGPASSFILE=${pgpassFile} psql -h ${readerConfig.host} -p ${readerConfig.port} -U ${readerConfig.user} -d ${readerConfig.database} -c "SELECT 'reader_test' as source, NOW() as timestamp;"`,
      '测试读库PostgreSQL连接'
    );
    
    // 清理临时文件
    fs.unlinkSync(pgpassFile);
    
  } catch (error) {
    log('red', `PostgreSQL连接测试出错: ${error.message}`);
  }

  // 5. AWS CLI 检查（如果可用）
  log('cyan', '\\n☁️  步骤5: AWS配置检查');
  
  const awsVersion = execCommand('aws --version', '检查AWS CLI版本');
  if (awsVersion.success) {
    const awsIdentity = execCommand('aws sts get-caller-identity', '检查AWS身份');
    
    // 获取RDS集群信息
    const clusterName = writerConfig.host.split('.')[0];
    const awsRegion = writerConfig.host.split('.')[2];
    
    log('white', `推测集群名称: ${clusterName}`);
    log('white', `推测AWS区域: ${awsRegion}`);
    
    const rdsDescribe = execCommand(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterName} --region ${awsRegion}`,
      `获取RDS集群 ${clusterName} 信息`
    );
    
    if (rdsDescribe.success) {
      try {
        const clusterInfo = JSON.parse(rdsDescribe.output);
        const cluster = clusterInfo.DBClusters[0];
        
        log('green', '\\n📊 RDS集群状态:');
        log('white', `  状态: ${cluster.Status}`);
        log('white', `  引擎: ${cluster.Engine} ${cluster.EngineVersion}`);
        log('white', `  VPC ID: ${cluster.DbClusterResourceId}`);
        log('white', `  安全组: ${cluster.VpcSecurityGroups?.map(sg => sg.VpcSecurityGroupId).join(', ')}`);
        
        // 获取实例信息
        const instances = cluster.DBClusterMembers || [];
        log('green', '\\n🔍 集群实例:');
        instances.forEach(instance => {
          log('white', `  ${instance.DBInstanceIdentifier}: ${instance.IsClusterWriter ? '写实例' : '读实例'}`);
        });
        
      } catch (parseError) {
        log('yellow', '⚠️  RDS集群信息解析失败');
      }
    }
  }

  // 6. 总结和建议
  log('cyan', '\\n📋 诊断总结与建议:');
  
  const issues = [];
  const suggestions = [];

  if (!writerDns.success || !readerDns.success) {
    issues.push('DNS解析失败');
    suggestions.push('检查域名配置或网络连接');
  }

  if (!writerPing.success || !readerPing.success) {
    issues.push('主机无法ping通');
    suggestions.push('检查安全组规则，确保允许ICMP流量');
  }

  if (!writerPort.success || !readerPort.success) {
    issues.push('数据库端口不通');
    suggestions.push('检查安全组规则，确保允许5432端口入站流量');
    suggestions.push('检查网络ACL配置');
    suggestions.push('确认数据库实例状态正常');
  }

  if (issues.length > 0) {
    log('red', '\\n❌ 发现问题:');
    issues.forEach(issue => log('white', `  • ${issue}`));
    
    log('yellow', '\\n💡 建议解决方案:');
    suggestions.forEach(suggestion => log('white', `  • ${suggestion}`));
    
    log('yellow', '\\n🔧 AWS控制台检查清单:');
    log('white', '  1. RDS -> 数据库 -> 检查集群和实例状态');
    log('white', '  2. VPC -> 安全组 -> 检查入站规则（端口5432）');
    log('white', '  3. VPC -> 网络ACL -> 检查子网访问规则');
    log('white', '  4. RDS -> 参数组 -> 检查数据库配置');
    log('white', '  5. CloudWatch -> 日志 -> 查看数据库错误日志');
    
  } else {
    log('green', '\\n✅ 所有网络连接测试通过！');
    log('yellow', '  如果应用仍无法连接，请检查:');
    log('white', '    • 数据库用户权限');
    log('white', '    • SSL/TLS配置');
    log('white', '    • 连接池配置');
  }
}

// 运行诊断
if (require.main === module) {
  diagnoseAuroraConnection().catch(error => {
    log('red', `诊断过程出错: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { diagnoseAuroraConnection };