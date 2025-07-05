import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { createEnhancedPrismaClient } from './db-helper';

// Job数据结构
interface JobData {
  jobTitle: string;
  category: string;
  description: string;
  deliverables: string;
  budget: any;
  maxBudget?: number;
  deadline: string | Date;
  paymentType: string;
  priority: string;
  skillLevel: string;
  tags: string[];
  autoAssign?: boolean;
  allowBidding?: boolean;
  allowParallelExecution?: boolean;
  escrowEnabled?: boolean;
  isPublic?: boolean;
  walletAddress: string;
}

// 从JSON文件导入Job数据
async function importJobsFromJson(filePath: string) {
  const prisma = await createEnhancedPrismaClient();
  if (!prisma) {
    console.error(chalk.red('❌ 无法连接到数据库，导入终止'));
    return;
  }

  try {
    console.log(chalk.blue('📋 开始导入任务数据...'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    // 读取文件内容
    const data = fs.readFileSync(path.resolve(filePath), 'utf8');
    const jobs: JobData[] = JSON.parse(data);

    console.log(chalk.yellow(`📋 共发现 ${jobs.length} 个任务待导入`));

    // 批量创建Job
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        // 处理日期
        if (job.deadline) {
          job.deadline = new Date(job.deadline);
        }

        // 创建Job
        await prisma.job.create({
          data: job,
        });

        successCount++;
        console.log(
          chalk.green(`✅ [${i + 1}/${jobs.length}] 成功导入: ${job.jobTitle}`),
        );
      } catch (error) {
        errorCount++;
        console.error(
          chalk.red(`❌ [${i + 1}/${jobs.length}] 导入失败: ${job.jobTitle}`),
        );
        console.error(
          chalk.red(
            `   错误信息: ${error instanceof Error ? error.message : '未知错误'}`,
          ),
        );
      }
    }

    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(
      chalk.blue(`📊 导入结果: 成功 ${successCount} 个, 失败 ${errorCount} 个`),
    );

    if (successCount === jobs.length) {
      console.log(chalk.green('🎉 所有任务导入成功!'));
    } else {
      console.log(chalk.yellow('⚠️ 部分任务导入失败，请检查错误信息'));
    }
  } catch (error) {
    console.error(chalk.red('❌ 导入过程中发生错误:'));
    console.error(
      chalk.red(error instanceof Error ? error.message : '未知错误'),
    );
  } finally {
    // 关闭数据库连接
    await prisma.$disconnect();
  }
}

// 交互式创建单个Job
async function createSingleJob() {
  const prisma = await createEnhancedPrismaClient();
  if (!prisma) {
    console.error(chalk.red('❌ 无法连接到数据库，导入终止'));
    return;
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string) =>
    new Promise<string>((resolve) => rl.question(query, resolve));

  try {
    console.log(chalk.blue('📝 创建新任务'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    const job: JobData = {
      jobTitle: await question(chalk.cyan('任务标题: ')),
      category: await question(chalk.cyan('任务分类: ')),
      description: await question(chalk.cyan('任务描述: ')),
      deliverables: await question(chalk.cyan('交付物: ')),
      paymentType: await question(chalk.cyan('支付类型: ')),
      priority: await question(chalk.cyan('优先级: ')),
      skillLevel: await question(chalk.cyan('技能等级: ')),
      tags: (await question(chalk.cyan('标签(用逗号分隔): ')))
        .split(',')
        .map((tag) => tag.trim()),
      walletAddress: await question(chalk.cyan('钱包地址: ')),
      deadline: new Date(await question(chalk.cyan('截止日期(YYYY-MM-DD): '))),
      budget: 0, // 添加临时值，后面会被覆盖
    };

    // 预算处理
    const budgetType = await question(chalk.cyan('预算类型(fixed/range): '));
    if (budgetType === 'fixed') {
      const amount = parseFloat(await question(chalk.cyan('预算金额: ')));
      job.budget = amount;
    } else {
      const minAmount = parseFloat(await question(chalk.cyan('最小预算: ')));
      const maxAmount = parseFloat(await question(chalk.cyan('最大预算: ')));
      job.budget = { min: minAmount, max: maxAmount };
      job.maxBudget = maxAmount;
    }

    // 高级选项
    console.log(chalk.yellow('\n高级选项:'));

    const autoAssignAnswer = await question(chalk.cyan('是否自动分配(y/n): '));
    job.autoAssign = autoAssignAnswer.toLowerCase() === 'y';

    const allowBiddingAnswer = await question(
      chalk.cyan('是否允许竞标(y/n): '),
    );
    job.allowBidding = allowBiddingAnswer.toLowerCase() === 'y';

    const allowParallelAnswer = await question(
      chalk.cyan('是否允许并行执行(y/n): '),
    );
    job.allowParallelExecution = allowParallelAnswer.toLowerCase() === 'y';

    const escrowEnabledAnswer = await question(
      chalk.cyan('是否启用托管(y/n): '),
    );
    job.escrowEnabled = escrowEnabledAnswer.toLowerCase() === 'y';

    const isPublicAnswer = await question(chalk.cyan('是否公开(y/n): '));
    job.isPublic = isPublicAnswer.toLowerCase() === 'y';

    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('📝 任务信息预览:'));
    console.log(JSON.stringify(job, null, 2));

    const confirmAnswer = await question(chalk.cyan('确认创建(y/n): '));
    if (confirmAnswer.toLowerCase() === 'y') {
      await prisma.job.create({
        data: job,
      });
      console.log(chalk.green('✅ 任务创建成功!'));
    } else {
      console.log(chalk.yellow('⚠️ 已取消创建'));
    }
  } catch (error) {
    console.error(chalk.red('❌ 创建任务失败:'));
    console.error(
      chalk.red(error instanceof Error ? error.message : '未知错误'),
    );
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'import') {
    const filePath = args[1];
    if (!filePath) {
      console.error(chalk.red('❌ 请提供JSON文件路径'));
      console.log(
        chalk.yellow(
          '使用方式: npx ts-node scripts/import-jobs.ts import ./data/jobs.json',
        ),
      );
      process.exit(1);
    }
    await importJobsFromJson(filePath);
  } else if (command === 'create') {
    await createSingleJob();
  } else {
    console.log(chalk.blue('📋 任务管理工具'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('可用命令:'));
    console.log(chalk.cyan('import <file>') + ' - 从JSON文件导入多个任务');
    console.log(chalk.cyan('create') + ' - 交互式创建单个任务');
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('示例:'));
    console.log(
      chalk.gray('npx ts-node scripts/import-jobs.ts import ./data/jobs.json'),
    );
    console.log(chalk.gray('npx ts-node scripts/import-jobs.ts create'));
  }
}

// 执行主函数
main().catch((error) => {
  console.error(chalk.red('❌ 程序执行失败:'));
  console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
  process.exit(1);
});
