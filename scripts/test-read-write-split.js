#!/usr/bin/env node

const axios = require('axios');
const colors = require('colors');

// 配置
const BASE_URL = 'http://localhost:8092/api';
const DELAY_BETWEEN_TESTS = 1000; // 1秒

// 测试数据
const testAgent = {
  agentName: 'TestAgent_ReadWriteSplit',
  agentAddress: 'http://test-agent.com',
  description: 'Test agent for read-write split validation',
  authorBio: 'Test Author',
  agentClassification: 'Test Classification',
  tags: ['test', 'read-write-split'],
  isPrivate: false,
  autoAcceptJobs: true,
  contractType: 'result',
  walletAddress: '0x1234567890123456789012345678901234567890'
};

const testJob = {
  jobTitle: 'TestJob_ReadWriteSplit',
  category: 'test',
  description: 'Test job for read-write split validation',
  deliverables: 'Test deliverables',
  budget: { amount: 1000, currency: 'USD' },
  maxBudget: 1000,
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  paymentType: 'fixed',
  priority: 'medium',
  skillLevel: 'intermediate',
  tags: ['test', 'read-write-split'],
  walletAddress: '0x1234567890123456789012345678901234567890'
};

// 工具函数
async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(method, url, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.message, 
      status: error.response?.status,
      data: error.response?.data 
    };
  }
}

// 测试函数
async function testHealthCheck() {
  console.log('\n🔍 测试1: 健康检查'.cyan.bold);
  
  const result = await makeRequest('GET', '/health/database');
  if (result.success) {
    console.log('✅ 健康检查成功'.green);
    console.log('📊 连接状态:'.blue);
    console.log(JSON.stringify(result.data, null, 2));
    
    // 修复数据路径访问
    const connections = result.data?.data?.connections || result.data?.connections;
    if (connections && connections.writer && connections.reader) {
      console.log('✅ 读写分离配置正确'.green);
    } else {
      console.log('❌ 读写分离配置异常'.red);
    }
  } else {
    console.log('❌ 健康检查失败:'.red, result.error);
  }
  
  return result.success;
}

async function testWriteOperations() {
  console.log('\n✏️  测试2: 写操作测试'.cyan.bold);
  
  // 创建Agent
  console.log('📝 创建测试Agent...'.blue);
  const agentResult = await makeRequest('POST', '/agents', testAgent);
  
  if (agentResult.success) {
    console.log('✅ Agent创建成功'.green);
    const agentData = agentResult.data?.data || agentResult.data;
    console.log('🆔 Agent ID:', agentData.id);
  } else {
    console.log('❌ Agent创建失败:'.red, agentResult.error);
    return null;
  }
  
  // 创建Job
  console.log('📝 创建测试Job...'.blue);
  const jobResult = await makeRequest('POST', '/jobs', testJob);
  
  if (jobResult.success) {
    console.log('✅ Job创建成功'.green);
    const jobData = jobResult.data?.data || jobResult.data;
    console.log('🆔 Job ID:', jobData.id);
  } else {
    console.log('❌ Job创建失败:'.red, jobResult.error);
    return null;
  }
  
  const agentData = agentResult.data?.data || agentResult.data;
  const jobData = jobResult.data?.data || jobResult.data;
  
  return {
    agentId: agentData.id,
    jobId: jobData.id
  };
}

async function testReadOperations(ids) {
  console.log('\n👁️  测试3: 读操作测试'.cyan.bold);
  
  if (!ids) {
    console.log('❌ 无法进行读操作测试，缺少测试数据'.red);
    return false;
  }
  
  // 立即读取（测试读写分离的一致性）
  console.log('📖 立即读取刚创建的数据...'.blue);
  
  const agentReadResult = await makeRequest('GET', `/agents/${ids.agentId}`);
  const jobReadResult = await makeRequest('GET', `/jobs/${ids.jobId}`);
  
  if (agentReadResult.success) {
    console.log('✅ Agent读取成功'.green);
    const agentData = agentReadResult.data?.data || agentReadResult.data;
    console.log('📄 Agent名称:', agentData.agentName);
  } else {
    console.log('❌ Agent读取失败:'.red, agentReadResult.error);
  }
  
  if (jobReadResult.success) {
    console.log('✅ Job读取成功'.green);
    const jobData = jobReadResult.data?.data || jobReadResult.data;
    console.log('📄 Job标题:', jobData.jobTitle);
  } else {
    console.log('❌ Job读取失败:'.red, jobReadResult.error);
  }
  
  // 列表查询
  console.log('📋 测试列表查询...'.blue);
  const agentListResult = await makeRequest('GET', '/agents');
  const jobListResult = await makeRequest('GET', '/jobs');
  
  if (agentListResult.success) {
    console.log('✅ Agent列表查询成功'.green);
    const agentListData = agentListResult.data?.data || agentListResult.data;
    console.log('📊 Agent总数:', Array.isArray(agentListData) ? agentListData.length : 'N/A');
  } else {
    console.log('❌ Agent列表查询失败:'.red, agentListResult.error);
  }
  
  if (jobListResult.success) {
    console.log('✅ Job列表查询成功'.green);
    const jobListData = jobListResult.data?.data || jobListResult.data;
    console.log('📊 Job总数:', Array.isArray(jobListData) ? jobListData.length : 'N/A');
  } else {
    console.log('❌ Job列表查询失败:'.red, jobListResult.error);
  }
  
  return agentReadResult.success && jobReadResult.success;
}

async function testUpdateOperations(ids) {
  console.log('\n🔄 测试4: 更新操作测试'.cyan.bold);
  
  if (!ids) {
    console.log('❌ 无法进行更新操作测试，缺少测试数据'.red);
    return false;
  }
  
  // 更新Agent
  console.log('🔄 更新Agent...'.blue);
  const agentUpdateData = {
    description: 'Updated description for read-write split test',
    tags: ['updated', 'read-write-split']
  };
  
  const agentUpdateResult = await makeRequest('PATCH', `/agents/${ids.agentId}`, agentUpdateData);
  
  if (agentUpdateResult.success) {
    console.log('✅ Agent更新成功'.green);
  } else {
    console.log('❌ Agent更新失败:'.red, agentUpdateResult.error);
  }
  
  // 更新Job
  console.log('🔄 更新Job...'.blue);
  const jobUpdateData = {
    description: 'Updated description for read-write split test',
    tags: ['updated', 'read-write-split']
  };
  
  const jobUpdateResult = await makeRequest('PATCH', `/jobs/${ids.jobId}`, jobUpdateData);
  
  if (jobUpdateResult.success) {
    console.log('✅ Job更新成功'.green);
  } else {
    console.log('❌ Job更新失败:'.red, jobUpdateResult.error);
  }
  
  return agentUpdateResult.success && jobUpdateResult.success;
}

async function testReadAfterUpdate(ids) {
  console.log('\n🔍 测试5: 更新后读取测试'.cyan.bold);
  
  if (!ids) {
    console.log('❌ 无法进行更新后读取测试，缺少测试数据'.red);
    return false;
  }
  
  // 等待一小段时间，模拟读写分离的延迟
  console.log('⏳ 等待数据同步...'.blue);
  await delay(2000);
  
  const agentReadResult = await makeRequest('GET', `/agents/${ids.agentId}`);
  const jobReadResult = await makeRequest('GET', `/jobs/${ids.jobId}`);
  
  if (agentReadResult.success) {
    console.log('✅ Agent读取成功'.green);
    console.log('📄 更新后的描述:', agentReadResult.data.description);
  } else {
    console.log('❌ Agent读取失败:'.red, agentReadResult.error);
  }
  
  if (jobReadResult.success) {
    console.log('✅ Job读取成功'.green);
    console.log('📄 更新后的描述:', jobReadResult.data.description);
  } else {
    console.log('❌ Job读取失败:'.red, jobReadResult.error);
  }
  
  return agentReadResult.success && jobReadResult.success;
}

async function cleanup(ids) {
  console.log('\n🧹 清理测试数据'.cyan.bold);
  
  if (!ids) {
    console.log('❌ 无法清理，缺少测试数据ID'.red);
    return;
  }
  
  // 删除Agent
  console.log('🗑️  删除测试Agent...'.blue);
  const agentDeleteResult = await makeRequest('DELETE', `/agents/${ids.agentId}`);
  
  if (agentDeleteResult.success) {
    console.log('✅ Agent删除成功'.green);
  } else {
    console.log('❌ Agent删除失败:'.red, agentDeleteResult.error);
  }
  
  // 删除Job
  console.log('🗑️  删除测试Job...'.blue);
  const jobDeleteResult = await makeRequest('DELETE', `/jobs/${ids.jobId}`);
  
  if (jobDeleteResult.success) {
    console.log('✅ Job删除成功'.green);
  } else {
    console.log('❌ Job删除失败:'.red, jobDeleteResult.error);
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始读写分离测试'.rainbow.bold);
  console.log('=' * 50);
  
  const startTime = Date.now();
  let testResults = [];
  
  try {
    // 测试1: 健康检查
    const healthResult = await testHealthCheck();
    testResults.push({ name: '健康检查', success: healthResult });
    
    if (!healthResult) {
      console.log('\n❌ 健康检查失败，停止测试'.red.bold);
      return;
    }
    
    await delay(DELAY_BETWEEN_TESTS);
    
    // 测试2: 写操作
    const writeResult = await testWriteOperations();
    testResults.push({ name: '写操作', success: !!writeResult });
    
    if (!writeResult) {
      console.log('\n❌ 写操作失败，停止测试'.red.bold);
      return;
    }
    
    await delay(DELAY_BETWEEN_TESTS);
    
    // 测试3: 读操作
    const readResult = await testReadOperations(writeResult);
    testResults.push({ name: '读操作', success: readResult });
    
    await delay(DELAY_BETWEEN_TESTS);
    
    // 测试4: 更新操作
    const updateResult = await testUpdateOperations(writeResult);
    testResults.push({ name: '更新操作', success: updateResult });
    
    await delay(DELAY_BETWEEN_TESTS);
    
    // 测试5: 更新后读取
    const readAfterUpdateResult = await testReadAfterUpdate(writeResult);
    testResults.push({ name: '更新后读取', success: readAfterUpdateResult });
    
    await delay(DELAY_BETWEEN_TESTS);
    
    // 清理测试数据
    await cleanup(writeResult);
    
  } catch (error) {
    console.log('\n❌ 测试过程中发生错误:'.red.bold, error.message);
  }
  
  // 输出测试结果
  console.log('\n📊 测试结果汇总'.rainbow.bold);
  console.log('=' * 50);
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  testResults.forEach((result, index) => {
    const status = result.success ? '✅ 通过'.green : '❌ 失败'.red;
    console.log(`${index + 1}. ${result.name}: ${status}`);
  });
  
  console.log('');
  console.log(`总计: ${totalTests} 个测试`);
  console.log(`通过: ${passedTests} 个`.green);
  console.log(`失败: ${failedTests} 个`.red);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  console.log(`耗时: ${duration.toFixed(2)} 秒`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！读写分离功能正常工作！'.green.bold);
  } else {
    console.log('\n⚠️  部分测试失败，请检查读写分离配置'.yellow.bold);
  }
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ 测试运行失败:'.red.bold, error);
    process.exit(1);
  });
}

module.exports = { runTests };