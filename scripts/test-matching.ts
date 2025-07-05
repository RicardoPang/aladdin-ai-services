import { PrismaClient } from '@prisma/client';
import { matchJobsWithAgents, calculateMatchScore } from './match-jobs-agents';

const prisma = new PrismaClient();

// 测试匹配算法的函数
function testMatchingAlgorithm() {
  console.log('🧪 测试匹配算法...');
  console.log('=' .repeat(50));
  
  // 测试用例
  const testCases = [
    {
      name: '完全匹配测试',
      jobCategory: 'Web开发',
      jobTags: ['HTML', 'CSS', 'JavaScript'],
      agentClassification: 'Web开发',
      agentTags: ['HTML', 'CSS', 'JavaScript', 'React'],
      expectedMinScore: 80
    },
    {
      name: '部分匹配测试',
      jobCategory: 'Web开发',
      jobTags: ['React', 'Node.js'],
      agentClassification: '编程助手',
      agentTags: ['React', 'Python', 'JavaScript'],
      expectedMinScore: 30
    },
    {
      name: '通用助手测试',
      jobCategory: '内容创作',
      jobTags: ['AI', '写作'],
      agentClassification: '通用助手',
      agentTags: ['问答', '任务执行'],
      expectedMinScore: 10
    },
    {
      name: '无匹配测试',
      jobCategory: '数据分析',
      jobTags: ['Python', '机器学习'],
      agentClassification: '移动开发',
      agentTags: ['iOS', 'Swift'],
      expectedMinScore: 0
    }
  ];
  
  let passedTests = 0;
  
  testCases.forEach((testCase, index) => {
    console.log(`\n测试 ${index + 1}: ${testCase.name}`);
    console.log(`任务: ${testCase.jobCategory} [${testCase.jobTags.join(', ')}]`);
    console.log(`Agent: ${testCase.agentClassification} [${testCase.agentTags.join(', ')}]`);
    
    const result = calculateMatchScore(
      testCase.jobCategory,
      testCase.jobTags,
      testCase.agentClassification,
      testCase.agentTags
    );
    
    console.log(`  匹配分数: ${result.score}`);
    console.log(`  匹配原因: ${result.reasons.join(', ')}`);
    
    const score = result.score;
    const passed = score >= testCase.expectedMinScore;
    console.log(`结果: ${passed ? '✅ 通过' : '❌ 失败'} (期望最低分数: ${testCase.expectedMinScore})`);
    
    if (passed) passedTests++;
  });
  
  console.log(`\n📊 测试结果: ${passedTests}/${testCases.length} 个测试通过`);
  return passedTests === testCases.length;
}

// 测试数据库连接和数据
async function testDatabaseData() {
  console.log('\n🗄️ 测试数据库数据...');
  console.log('=' .repeat(50));
  
  try {
    // 测试Agent数据
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        autoAcceptJobs: true
      }
    });
    
    console.log(`✅ 找到 ${agents.length} 个可用Agent`);
    agents.forEach(agent => {
      console.log(`   - ${agent.agentName} (${agent.agentClassification}) [${agent.tags.join(', ')}]`);
    });
    
    // 测试Job数据
    const jobs = await prisma.job.findMany({
      where: {
        status: 'OPEN'
      }
    });
    
    console.log(`\n✅ 找到 ${jobs.length} 个开放任务`);
    jobs.forEach(job => {
      console.log(`   - ${job.jobTitle} (${job.category}) [${job.tags.join(', ')}]`);
    });
    
    return { agents: agents.length, jobs: jobs.length };
    
  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
    return null;
  }
}

// 测试完整匹配流程
async function testFullMatchingProcess() {
  console.log('\n🔄 测试完整匹配流程...');
  console.log('=' .repeat(50));
  
  try {
    const results = await matchJobsWithAgents();
    
    console.log(`✅ 匹配完成，处理了 ${results.length} 个任务`);
    
    // 显示匹配摘要
    results.forEach(result => {
      console.log(`\n📋 任务: ${result.jobTitle}`);
      console.log(`   分类: ${result.category}`);
      console.log(`   标签: [${result.tags.join(', ')}]`);
      console.log(`   匹配Agent数: ${result.matches ? result.matches.length : 0}`);
      
      if (result.matches && result.matches.length > 0) {
        const bestMatch = result.matches[0];
        console.log(`   最佳匹配: ${bestMatch.agentName} (分数: ${bestMatch.matchScore})`);
      } else {
        console.log(`   ⚠️ 未找到匹配的Agent`);
      }
    });
    
    return results;
    
  } catch (error) {
    console.error('❌ 匹配流程测试失败:', error);
    return null;
  }
}

// 主测试函数
async function runAllTests() {
  console.log('🚀 开始匹配系统测试...');
  console.log('=' .repeat(60));
  
  const testResults = {
    algorithm: false,
    database: false,
    fullProcess: false
  };
  
  try {
    // 1. 测试匹配算法
    testResults.algorithm = testMatchingAlgorithm();
    
    // 2. 测试数据库数据
    const dbData = await testDatabaseData();
    testResults.database = dbData !== null && dbData.agents > 0 && dbData.jobs > 0;
    
    // 3. 测试完整匹配流程
    if (testResults.database) {
      const matchResults = await testFullMatchingProcess();
      testResults.fullProcess = matchResults !== null;
    } else {
      console.log('\n⚠️ 跳过完整流程测试（数据库数据不足）');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
  
  // 显示最终测试结果
  console.log('\n📊 最终测试结果:');
  console.log('=' .repeat(60));
  console.log(`匹配算法测试: ${testResults.algorithm ? '✅ 通过' : '❌ 失败'}`);
  console.log(`数据库数据测试: ${testResults.database ? '✅ 通过' : '❌ 失败'}`);
  console.log(`完整流程测试: ${testResults.fullProcess ? '✅ 通过' : '❌ 失败'}`);
  
  const allPassed = Object.values(testResults).every(result => result);
  console.log(`\n🎯 总体结果: ${allPassed ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);
  
  if (allPassed) {
    console.log('\n🎉 匹配系统运行正常，可以开始使用！');
    console.log('\n💡 下一步建议:');
    console.log('   1. 运行 npm run match:jobs-agents 执行实际匹配');
    console.log('   2. 检查 data/match-results.json 查看匹配结果');
    console.log('   3. 使用 API 接口测试匹配功能');
  } else {
    console.log('\n🔧 请检查以下问题:');
    if (!testResults.algorithm) console.log('   - 匹配算法逻辑需要调整');
    if (!testResults.database) console.log('   - 数据库连接或数据导入问题');
    if (!testResults.fullProcess) console.log('   - 完整匹配流程存在问题');
  }
  
  return allPassed;
}

// 如果直接运行此脚本
if (require.main === module) {
  runAllTests();
}

export { runAllTests, testMatchingAlgorithm, testDatabaseData, testFullMatchingProcess };