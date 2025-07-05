import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 匹配结果接口
interface MatchResult {
  agentId: string;
  agentName: string;
  agentClassification: string;
  tags: string[];
  matchScore: number;
  matchReasons: string[];
}

interface JobMatchResult {
  jobId: string;
  jobTitle: string;
  category: string;
  tags: string[];
  matches: MatchResult[];
}

// 计算匹配分数的函数
function calculateMatchScore(
  jobCategory: string,
  jobTags: string[],
  agentClassification: string,
  agentTags: string[]
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. 分类匹配 (权重: 40分)
  if (jobCategory === agentClassification) {
    score += 40;
    reasons.push(`分类完全匹配: ${jobCategory}`);
  } else {
    // 部分分类匹配逻辑
    const categoryMappings: { [key: string]: string[] } = {
      'Web开发': ['编程助手', '通用助手'],
      '内容创作': ['通用助手'],
      '数据分析': ['编程助手', '通用助手'],
      '移动开发': ['编程助手', '通用助手']
    };
    
    if (categoryMappings[jobCategory]?.includes(agentClassification)) {
      score += 20;
      reasons.push(`分类部分匹配: ${jobCategory} -> ${agentClassification}`);
    }
  }

  // 2. 标签匹配 (权重: 最多50分)
  const matchingTags = jobTags.filter(jobTag => 
    agentTags.some(agentTag => 
      jobTag.toLowerCase() === agentTag.toLowerCase() ||
      jobTag.toLowerCase().includes(agentTag.toLowerCase()) ||
      agentTag.toLowerCase().includes(jobTag.toLowerCase())
    )
  );

  if (matchingTags.length > 0) {
    const tagScore = Math.min(50, matchingTags.length * 15);
    score += tagScore;
    reasons.push(`标签匹配 (${matchingTags.length}个): ${matchingTags.join(', ')}`);
  }

  // 3. 通用助手加分 (权重: 10分)
  if (agentClassification === '通用助手') {
    score += 10;
    reasons.push('通用助手加分');
  }

  return { score, reasons };
}

// 主匹配函数
async function matchJobsWithAgents(): Promise<JobMatchResult[]> {
  console.log('🚀 开始执行任务与Agent匹配...');
  
  try {
    // 获取所有活跃的任务
    const jobs = await prisma.job.findMany({
      where: {
        status: 'OPEN'
      }
    });

    // 获取所有可用的Agent
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        autoAcceptJobs: true
      }
    });

    console.log(`📋 找到 ${jobs.length} 个开放任务`);
    console.log(`🤖 找到 ${agents.length} 个可用Agent`);

    const matchResults: JobMatchResult[] = [];

    // 为每个任务寻找匹配的Agent
    for (const job of jobs) {
      console.log(`\n🔍 正在为任务 "${job.jobTitle}" 寻找匹配的Agent...`);
      
      const jobMatches: MatchResult[] = [];

      // 计算每个Agent与当前任务的匹配分数
      for (const agent of agents) {
        const { score, reasons } = calculateMatchScore(
          job.category,
          job.tags,
          agent.agentClassification,
          agent.tags
        );

        if (score > 0) {
          jobMatches.push({
            agentId: agent.id,
            agentName: agent.agentName,
            agentClassification: agent.agentClassification,
            tags: agent.tags,
            matchScore: score,
            matchReasons: reasons
          });
        }
      }

      // 按匹配分数排序
      jobMatches.sort((a, b) => b.matchScore - a.matchScore);

      // 只保留前5个最佳匹配
      const topMatches = jobMatches.slice(0, 5);

      matchResults.push({
        jobId: job.id,
        jobTitle: job.jobTitle,
        category: job.category,
        tags: job.tags,
        matches: topMatches
      });

      console.log(`   ✅ 找到 ${topMatches.length} 个匹配的Agent`);
      topMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. ${match.agentName} (分数: ${match.matchScore})`);
        console.log(`      匹配原因: ${match.matchReasons.join(', ')}`);
      });
    }

    return matchResults;
  } catch (error) {
    console.error('❌ 匹配过程中发生错误:', error);
    throw error;
  }
}

// 保存匹配结果到文件
function saveMatchResults(results: JobMatchResult[], filename: string = 'match-results.json') {
  const outputPath = path.join(__dirname, '..', 'data', filename);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n💾 匹配结果已保存到: ${outputPath}`);
}

// 显示匹配统计信息
function displayMatchStatistics(results: JobMatchResult[]) {
  console.log('\n📊 匹配统计信息:');
  console.log('=' .repeat(50));
  
  let totalMatches = 0;
  let jobsWithMatches = 0;
  let jobsWithoutMatches = 0;
  
  results.forEach(result => {
    if (result.matches.length > 0) {
      jobsWithMatches++;
      totalMatches += result.matches.length;
    } else {
      jobsWithoutMatches++;
    }
  });
  
  console.log(`总任务数: ${results.length}`);
  console.log(`有匹配Agent的任务: ${jobsWithMatches}`);
  console.log(`无匹配Agent的任务: ${jobsWithoutMatches}`);
  console.log(`总匹配数: ${totalMatches}`);
  console.log(`平均每个任务的匹配数: ${(totalMatches / results.length).toFixed(2)}`);
  
  // 按分类统计
  const categoryStats: { [key: string]: number } = {};
  results.forEach(result => {
    categoryStats[result.category] = (categoryStats[result.category] || 0) + result.matches.length;
  });
  
  console.log('\n按分类统计匹配数:');
  Object.entries(categoryStats).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} 个匹配`);
  });
}

// 执行匹配并创建分发记录
async function executeMatching() {
  try {
    console.log('🎯 开始智能任务匹配系统...');
    console.log('=' .repeat(60));
    
    const matchResults = await matchJobsWithAgents();
    
    // 显示统计信息
    displayMatchStatistics(matchResults);
    
    // 保存结果
    saveMatchResults(matchResults);
    
    // 为自动分配的任务创建分发记录
    console.log('\n🔄 处理自动分配任务...');
    
    for (const result of matchResults) {
      const job = await prisma.job.findUnique({ where: { id: result.jobId } });
      
      if (job?.autoAssign && result.matches.length > 0) {
        // 选择最佳匹配的Agent
        const bestMatch = result.matches[0];
        
        console.log(`   📤 自动分配任务 "${result.jobTitle}" 给 Agent "${bestMatch.agentName}"`);
        
        // 创建分发记录
        const distributionRecord = await prisma.jobDistributionRecord.create({
          data: {
            jobId: result.jobId,
            jobName: result.jobTitle,
            matchCriteria: {
              category: result.category,
              tags: result.tags,
              autoAssign: true
            },
            totalAgents: result.matches.length,
            assignedCount: 1,
            responseCount: 0,
            assignedAgentId: bestMatch.agentId,
            assignedAgentName: bestMatch.agentName
          }
        });
        
        // 创建Agent分配记录
        await prisma.jobDistributionAgent.create({
          data: {
            jobDistributionId: distributionRecord.id,
            agentId: bestMatch.agentId,
            assignedAt: new Date()
          }
        });
        
        console.log(`   ✅ 分发记录已创建`);
      }
    }
    
    console.log('\n🎉 匹配完成!');
    
  } catch (error) {
    console.error('❌ 执行匹配时发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  executeMatching();
}

export { matchJobsWithAgents, calculateMatchScore, MatchResult, JobMatchResult };