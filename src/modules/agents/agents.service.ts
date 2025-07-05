import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(private prisma: PrismaService) {}

  async create(createAgentDto: CreateAgentDto) {
    return await this.prisma.getWriterClient().agent.create({
      data: createAgentDto,
    });
  }

  async findAll() {
    return await this.prisma.getReaderClient().agent.findMany();
  }

  async findOne(id: string) {
    const agent = await this.prisma.getReaderClient().agent.findUnique({
      where: { id },
    });
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    return agent;
  }

  async update(id: string, updateAgentDto: UpdateAgentDto) {
    try {
      return await this.prisma.getWriterClient().agent.update({
        where: { id },
        data: updateAgentDto,
      });
    } catch (error) {
      throw new NotFoundException(`Agent with ID ${id} not found. ${error}`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.getWriterClient().agent.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Agent with ID ${id} not found. ${error}`);
    }
  }
}
