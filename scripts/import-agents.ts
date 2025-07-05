// agent入库
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import { createEnhancedPrismaClient } from './db-helper';

// Agent数据结构
interface AgentData {
  agentName: string;
  agentAddress: string;
  description: string;
  authorBio: string;
  agentClassification: string;
  tags: string[];
  isPrivate?: boolean;
  autoAcceptJobs?: boolean;
  contractType?: string;
  walletAddress: string;
}

// 导入agent数据
async function importAgentsFromJson(filePath: string) {
  const prisma = await createEnhancedPrismaClient();
  if (!prisma) {
    console.error(chalk.red('❌ 无法连接到数据库，导入终止'));
    return;
  }

  try {
    console.log(chalk.blue('🤖 开始导入Agent数据...'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    // 读取内容
    const data = fs.readFileSync(path.resolve(filePath), 'utf8');
    const agents: AgentData[] = JSON.parse(data);

    console.log(chalk.yellow(`📋 共发现 ${agents.length} 个Agent待导入`));

    // 批量创建
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      try {
        // 创建agent
        await prisma.agent.create({
          data: agent,
        });

        successCount++;
        console.log(
          chalk.green(
            `✅ [${i + 1}/${agents.length}] 成功导入: ${agent.agentName}`,
          ),
        );
      } catch (error) {
        errorCount++;
        console.error(
          chalk.red(
            `❌ [${i + 1}/${agents.length}] 导入失败: ${agent.agentName}`,
          ),
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

    if (successCount === agents.length) {
      console.log(chalk.green('🎉 所有Agent导入成功!'));
    } else {
      console.log(chalk.yellow('⚠️ 部分Agent导入失败，请检查错误信息'));
    }
  } catch (error) {
    console.error(chalk.red('❌ 导入过程中发生错误:'));
    console.error(
      chalk.red(error instanceof Error ? error.message : '未知错误'),
    );
  } finally {
    // 关闭数据库连接
    await prisma.disconnect();
  }
}

// 交互式创建单个Agent
async function createSingleAgent() {
  const prisma = await createEnhancedPrismaClient();
  if (!prisma) {
    console.error(chalk.red('❌ 无法连接到数据库，创建终止'));
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string) =>
    new Promise<string>((resolve) => rl.question(query, resolve));

  try {
    console.log(chalk.blue('🤖 创建新Agent'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    const agent: AgentData = {
      agentName: await question(chalk.cyan('Agent名称: ')),
      agentAddress: await question(chalk.cyan('Agent API地址: ')),
      description: await question(chalk.cyan('描述: ')),
      authorBio: await question(chalk.cyan('作者简介: ')),
      agentClassification: await question(chalk.cyan('分类: ')),
      tags: (await question(chalk.cyan('标签(用逗号分隔): ')))
        .split(',')
        .map((tag) => tag.trim()),
      walletAddress: await question(chalk.cyan('钱包地址: ')),
    };

    const isPrivateAnswer = await question(chalk.cyan('是否私有(y/n): '));
    agent.isPrivate = isPrivateAnswer.toLowerCase() === 'y';

    const autoAcceptAnswer = await question(
      chalk.cyan('是否自动接受任务(y/n): '),
    );
    agent.autoAcceptJobs = autoAcceptAnswer.toLowerCase() === 'y';

    agent.contractType =
      (await question(chalk.cyan('合约类型(默认为result): '))) || 'result';

    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('📝 Agent信息预览:'));
    console.log(JSON.stringify(agent, null, 2));

    const confirmAnswer = await question(chalk.cyan('确认创建(y/n): '));
    if (confirmAnswer.toLowerCase() === 'y') {
      await prisma.agent.create({
        data: agent,
      });
      console.log(chalk.green('✅ Agent创建成功!'));
    } else {
      console.log(chalk.yellow('⚠️ 已取消创建'));
    }
  } catch (error) {
    console.error(chalk.red('❌ 创建Agent失败:'));
    console.error(
      chalk.red(error instanceof Error ? error.message : '未知错误'),
    );
  } finally {
    rl.close();
    await prisma.disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'import') {
    const filepath = args[1];
    if (!filepath) {
      console.error(chalk.red('❌ 请提供JSON文件路径'));
      console.log(
        chalk.yellow(
          '使用方式: npx ts-node scripts/import-agents.ts import ./data/agents.json',
        ),
      );
      process.exit(1);
    }
    await importAgentsFromJson(filepath);
  } else if (command === 'create') {
    await createSingleAgent();
  } else {
    console.log(chalk.blue('🤖 Agent管理工具'));
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('可用命令:'));
    console.log(chalk.cyan('import <file>') + ' - 从JSON文件导入多个Agent');
    console.log(chalk.cyan('create') + ' - 交互式创建单个Agent');
    console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow('示例:'));
    console.log(
      chalk.gray(
        'npx ts-node scripts/import-agents.ts import ./data/agents.json',
      ),
    );
    console.log(chalk.gray('npx ts-node scripts/import-agents.ts create'));
  }
}

main().catch((error) => {
  console.error(chalk.red('❌ 程序执行失败:'));
  console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
  process.exit(1);
});
