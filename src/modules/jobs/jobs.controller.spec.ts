import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

describe('JobsController', () => {
  let controller: JobsController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let jobsService: JobsService;

  const mockJob = {
    id: 'job123',
    jobTitle: 'Test Job',
    description: 'This is a test job description',
    category: 'DATA_ANALYSIS',
    deliverables: 'Test deliverables',
    budget: { amount: 500, currency: 'USD' },
    deadline: new Date('2025-12-31'),
    paymentType: 'FIXED',
    priority: 'MEDIUM',
    skillLevel: 'INTERMEDIATE',
    tags: ['data', 'analysis', 'python'],
    autoAssign: false,
    allowBidding: true,
    allowParallelExecution: false,
    escrowEnabled: true,
    isPublic: true,
    walletAddress: 'wallet123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJobsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
    jobsService = module.get<JobsService>(JobsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createJobDto: CreateJobDto = {
      jobTitle: 'Test Job',
      description: 'This is a test job description',
      category: 'DATA_ANALYSIS',
      deliverables: 'Test deliverables',
      budget: { amount: 500, currency: 'USD' },
      deadline: new Date('2025-12-31'),
      paymentType: 'FIXED',
      priority: 'MEDIUM',
      skillLevel: 'INTERMEDIATE',
      tags: ['data', 'analysis', 'python'],
      autoAssign: false,
      allowBidding: true,
      allowParallelExecution: false,
      escrowEnabled: true,
      isPublic: true,
      walletAddress: 'wallet123',
    };

    it('should create a job successfully', async () => {
      mockJobsService.create.mockResolvedValue(mockJob);

      const result = await controller.create(createJobDto);

      expect(mockJobsService.create).toHaveBeenCalledWith(createJobDto);
      expect(result).toEqual(mockJob);
    });

    it('should handle errors during job creation', async () => {
      mockJobsService.create.mockRejectedValue(
        new BadRequestException('Invalid job data'),
      );

      await expect(controller.create(createJobDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all jobs', async () => {
      const jobs = [mockJob];
      mockJobsService.findAll.mockResolvedValue(jobs);

      const result = await controller.findAll();

      expect(mockJobsService.findAll).toHaveBeenCalled();
      expect(result).toEqual(jobs);
    });
  });

  describe('findOne', () => {
    it('should return a job by id', async () => {
      mockJobsService.findOne.mockResolvedValue(mockJob);

      const result = await controller.findOne('job123');

      expect(mockJobsService.findOne).toHaveBeenCalledWith('job123');
      expect(result).toEqual(mockJob);
    });

    it('should throw NotFoundException when job not found', async () => {
      mockJobsService.findOne.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateJobDto: UpdateJobDto = {
      jobTitle: 'Updated Job',
    };

    it('should update a job successfully', async () => {
      const updatedJob = {
        ...mockJob,
        jobTitle: 'Updated Job',
      };
      mockJobsService.update.mockResolvedValue(updatedJob);

      const result = await controller.update('job123', updateJobDto);

      expect(mockJobsService.update).toHaveBeenCalledWith(
        'job123',
        updateJobDto,
      );
      expect(result).toEqual(updatedJob);
    });

    it('should throw NotFoundException when job not found', async () => {
      mockJobsService.update.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await expect(
        controller.update('nonexistent', updateJobDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a job successfully', async () => {
      mockJobsService.remove.mockResolvedValue({ message: 'Job删除成功' });

      const result = await controller.remove('job123');

      expect(mockJobsService.remove).toHaveBeenCalledWith('job123');
      expect(result).toEqual({ message: 'Job删除成功' });
    });

    it('should throw NotFoundException when job not found', async () => {
      mockJobsService.remove.mockRejectedValue(
        new NotFoundException('Job not found'),
      );

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
