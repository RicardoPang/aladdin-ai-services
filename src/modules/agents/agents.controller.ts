import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentsService } from './agents.service';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ summary: '创建新Agent' })
  @ApiResponse({ status: 201, description: 'Agent创建成功' })
  create(@Body() createAgentDto: CreateAgentDto) {
    return this.agentsService.create(createAgentDto);
  }

  @Get()
  @ApiOperation({ summary: '获取所有Agent' })
  findAll() {
    return this.agentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID获取Agent' })
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新Agent' })
  update(@Param('id') id: string, @Body() updateAgentDto: UpdateAgentDto) {
    return this.agentsService.update(id, updateAgentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除Agent' })
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }
}
