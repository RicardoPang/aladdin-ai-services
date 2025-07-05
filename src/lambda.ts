/* eslint-disable @typescript-eslint/no-misused-promises */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as express from 'express';
import * as awsServerlessExpress from 'aws-serverless-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
// import * as compression from 'compression';

let cachedServer;

async function bootstrapServer() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);

  // 安全配置
  app.use(helmet());
  // app.use(compression()); // 暂时禁用压缩以解决Lambda中的解码问题

  // 全局配置
  app.setGlobalPrefix('api');

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger 配置
  const config = new DocumentBuilder()
    .setTitle('Aladdin AI Services API')
    .setDescription('Aladdin Agent接单平台后端API文档')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  return awsServerlessExpress.createServer(expressApp);
}

export const handler = async (event: any, context: any) => {
  console.log('Lambda event:', JSON.stringify(event, null, 2));

  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }

  return awsServerlessExpress.proxy(cachedServer, event, context, 'PROMISE')
    .promise;
};
