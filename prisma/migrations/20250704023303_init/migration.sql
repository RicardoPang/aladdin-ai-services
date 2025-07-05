-- CreateEnum
CREATE TYPE "aladdin_pf"."JobStatus" AS ENUM ('OPEN', 'DISTRIBUTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "aladdin_pf"."AgentWorkStatus" AS ENUM ('IDLE', 'ASSIGNED', 'WORKING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "aladdin_pf"."categories" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aladdin_pf"."agents" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentAddress" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorBio" TEXT NOT NULL,
    "agentClassification" TEXT NOT NULL,
    "tags" TEXT[],
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "autoAcceptJobs" BOOLEAN NOT NULL DEFAULT true,
    "contractType" TEXT NOT NULL DEFAULT 'result',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalJobsCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "walletAddress" TEXT NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aladdin_pf"."jobs" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "budget" JSONB NOT NULL,
    "maxBudget" DOUBLE PRECISION,
    "deadline" TIMESTAMP(3) NOT NULL,
    "paymentType" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "skillLevel" TEXT NOT NULL,
    "tags" TEXT[],
    "status" "aladdin_pf"."JobStatus" NOT NULL DEFAULT 'OPEN',
    "autoAssign" BOOLEAN NOT NULL DEFAULT false,
    "allowBidding" BOOLEAN NOT NULL DEFAULT true,
    "allowParallelExecution" BOOLEAN NOT NULL DEFAULT false,
    "escrowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "walletAddress" TEXT NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aladdin_pf"."job_distribution_records" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "matchCriteria" JSONB NOT NULL,
    "totalAgents" INTEGER NOT NULL,
    "assignedCount" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAgentId" TEXT,
    "assignedAgentName" TEXT,

    CONSTRAINT "job_distribution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aladdin_pf"."job_distribution_agents" (
    "id" TEXT NOT NULL,
    "jobDistributionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workStatus" "aladdin_pf"."AgentWorkStatus" NOT NULL DEFAULT 'ASSIGNED',
    "executionResult" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "progress" INTEGER,
    "errorMessage" TEXT,
    "executionTimeMs" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_distribution_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_distribution_records_jobId_key" ON "aladdin_pf"."job_distribution_records"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "job_distribution_agents_jobDistributionId_agentId_key" ON "aladdin_pf"."job_distribution_agents"("jobDistributionId", "agentId");

-- AddForeignKey
ALTER TABLE "aladdin_pf"."job_distribution_records" ADD CONSTRAINT "job_distribution_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "aladdin_pf"."jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aladdin_pf"."job_distribution_agents" ADD CONSTRAINT "job_distribution_agents_jobDistributionId_fkey" FOREIGN KEY ("jobDistributionId") REFERENCES "aladdin_pf"."job_distribution_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aladdin_pf"."job_distribution_agents" ADD CONSTRAINT "job_distribution_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "aladdin_pf"."agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
