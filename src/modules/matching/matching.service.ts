import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JobStatus, AgentWorkStatus, Job, Agent } from '@prisma/client';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private prisma: PrismaService) {}

  // 为Job分发任务给合适的Agent
  async distributeJob(jobId: string) {
    this.logger.log(`开始为Job ${jobId} 进行任务分发`);

    const job = await this.getJobById(jobId);
    const matchingAgents = await this.findMatchingAgents(job);
    const result = await this.createDistributionRecord(job, matchingAgents);

    this.logger.log(
      `Job ${jobId} 分发完成，共分发给 ${matchingAgents.length} 个Agent`,
    );
    return result;
  }

  // Job详情
  private async getJobById(jobId: string) {
    const job = await this.prisma.getReaderClient().job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} 不存在`);
    }

    if (job?.status !== JobStatus.OPEN) {
      throw new Error(`Job ${jobId} 状态不是OPEN，无法分发`);
    }

    return job;
  }

  // 使用分类category+tags标签 匹配agent和工作job，免费也要交押金，也要给平台付费，后面会退，全部在链上，公开透明
  private async findMatchingAgents(job: Job) {
    this.logger.log(`开始为Job查找匹配的Agent, tags: ${job.tags.join(', ')}`);

    const agents = await this.prisma.getReaderClient().agent.findMany({
      where: {
        isActive: true,
        autoAcceptJobs: true,
        AND: [
          {
            OR: [
              { agentClassification: job.category }, // 分类匹配
              { tags: { hasSome: job.tags } }, // 标签匹配
            ],
          },
        ],
      },
      orderBy: [
        { reputation: 'desc' },
        { successRate: 'desc' },
        { totalJobsCompleted: 'desc' },
      ],
      take: 5,
    });

    this.logger.log(`找到 ${agents.length} 个匹配的Agent`);
    return agents;
  }

  // 分发记录
  private async createDistributionRecord(job: Job, agents: Agent[]) {
    return await this.prisma.getWriterClient().$transaction(async (tx) => {
      const distributionRecord = await tx.jobDistributionRecord.create({
        data: {
          jobId: job.id,
          jobName: job.jobTitle,
          matchCriteria: {
            tags: job.tags,
            category: job.category,
            skillLevel: job.skillLevel,
          },
          totalAgents: agents.length,
          assignedCount: agents.length,
        },
      });

      // 2. 为每个Agent创建分发记录
      await Promise.all(
        agents.map((agent) =>
          tx.jobDistributionAgent.create({
            data: {
              jobDistributionId: distributionRecord.id,
              agentId: agent.id,
              workStatus: AgentWorkStatus.ASSIGNED,
            },
          }),
        ),
      );

      // 3. 更新Job状态
      await tx.job.update({
        where: { id: job.id },
        data: { status: JobStatus.DISTRIBUTED },
      });

      return {
        success: true,
        distributionId: distributionRecord.id,
        jobId: job.id,
        agentsCount: agents.length,
        agents: agents.map((a) => ({ id: a.id, name: a.agentName })),
      };
    });
  }
}
