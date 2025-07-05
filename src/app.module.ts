import { ThrottlerModule } from '@nestjs/throttler';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import { DatabaseModule } from './modules/database/database.module';
import { AgentsModule } from './modules/agents/agents.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    DatabaseModule,
    AgentsModule,
    JobsModule,
  ],
})
export class AppModule {}
