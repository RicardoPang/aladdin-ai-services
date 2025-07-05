import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async create(createJobDto: CreateJobDto) {
    // 将字符串日期转换为Date对象
    const deadline = new Date(createJobDto.deadline);

    return await this.prisma.getWriterClient().job.create({
      data: {
        ...createJobDto,
        deadline,
      },
    });
  }

  async findAll() {
    return await this.prisma.getReaderClient().job.findMany();
  }

  async findOne(id: string) {
    const job = await this.prisma.getReaderClient().job.findUnique({
      where: { id },
      include: {
        distributionRecord: {
          include: {
            assignedAgents: {
              include: {
                agent: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job with ID ${id} not found`);
    }

    return job;
  }

  async update(id: string, updateJobDto: UpdateJobDto) {
    // 处理日期
    const data = { ...updateJobDto };
    if (updateJobDto.deadline) {
      data.deadline = new Date(updateJobDto.deadline);
    }

    try {
      return await this.prisma.getWriterClient().job.update({
        where: { id },
        data,
      });
    } catch (error) {
      throw new NotFoundException(`Job with ID ${id} not found, ${error}`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.getWriterClient().job.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Job with ID ${id} not found, ${error}`);
    }
  }
}
