import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 简单的匹配分数计算函数
function calculateSimpleMatchScore(job: any, agent: any): number {
  let score = 0;
  
  // 分类匹配 (40分)
  if (job.category === agent.agentClassification) {
    score += 40;
  } else if (agent.agentClassification === '通用助手') {
    score += 10; // 通用助手加分
  } else if (
    (job.category === 'Web开发' && agent.agentClassification === '编程助手') ||
    (job.category === '移动开发' && agent.agentClassification === '编程助手') ||
    (job.category === '数据分析' && agent.agentClassification === '编程助手')
  ) {
    score += 20; // 部分匹配
  }
  
  // 标签匹配 (最多50分)
  const commonTags = job.tags.filter((tag: string) => agent.tags.includes(tag));
  score += Math.min(commonTags.length * 10, 50);
  
  return score;
}

async function testSimpleMatching() {
  console.log('🧪 简单匹配测试开始...');
  console.log('=' .repeat(50));
  
  try {
    // 测试数据库连接
    console.log('\n📊 测试数据库连接...');
    const jobCount = await prisma.job.count();
    const agentCount = await prisma.agent.count();
    console.log(`✅ 数据库连接成功！`);
    console.log(`   任务数量: ${jobCount}`);
    console.log(`   Agent数量: ${agentCount}`);
    
    // 测试匹配算法
    console.log('\n🔍 测试匹配算法...');
    
    const testCases = [
      {
        name: 'Web开发任务匹配编程助手',
        job: { category: 'Web开发', tags: ['HTML', 'CSS', 'JavaScript'] },
        agent: { agentClassification: '编程助手', tags: ['HTML', 'CSS', 'JavaScript', 'React'] },
        expectedMin: 50
      },
      {
        name: '通用助手匹配任意任务',
        job: { category: '内容创作', tags: ['AI', '写作'] },
        agent: { agentClassification: '通用助手', tags: ['问答', '任务执行'] },
        expectedMin: 10
      }
    ];
    
    testCases.forEach((testCase, index) => {
      console.log(`\n测试 ${index + 1}: ${testCase.name}`);
      const score = calculateSimpleMatchScore(testCase.job, testCase.agent);
      console.log(`  匹配分数: ${score}`);
      console.log(`  预期最低分: ${testCase.expectedMin}`);
      console.log(`  结果: ${score >= testCase.expectedMin ? '✅ 通过' : '❌ 失败'}`);
    });
    
    // 获取实际数据进行测试
    console.log('\n📋 使用实际数据测试...');
    const jobs = await prisma.job.findMany({ take: 2 });
    const agents = await prisma.agent.findMany({ take: 2 });
    
    if (jobs.length > 0 && agents.length > 0) {
      jobs.forEach((job, jobIndex) => {
        console.log(`\n任务 ${jobIndex + 1}: ${job.jobTitle}`);
        console.log(`  分类: ${job.category}`);
        console.log(`  标签: [${job.tags.join(', ')}]`);
        
        agents.forEach((agent, agentIndex) => {
          const score = calculateSimpleMatchScore(job, agent);
          console.log(`    Agent ${agentIndex + 1} (${agent.agentName}): ${score}分`);
        });
      });
    }
    
    console.log('\n✅ 所有测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testSimpleMatching();
}

export { testSimpleMatching, calculateSimpleMatchScore };