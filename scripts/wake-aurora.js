#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function wakeAurora() {
  console.log('🚀 尝试唤醒 Aurora 数据库...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
    statement_timeout: 30000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('⏳ 连接中...');
    await client.connect();
    
    console.log('✅ 连接成功！执行简单查询...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('📊 数据库信息:', result.rows[0]);
    
    console.log('🎉 Aurora 已唤醒，现在可以运行 Prisma 迁移了！');
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.log('💡 提示: Aurora 可能需要更长时间启动，请稍等片刻再试');
  } finally {
    await client.end();
  }
}

wakeAurora();