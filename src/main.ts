import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import type { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig>);

  // 安全配置
  app.use(helmet());

  // 启用压缩和CORS
  app.use(compression());
  app.enableCors({
    origin: configService.get('cors')?.origin ?? 'http://localhost:8092',
    credentials: true,
  });

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

  // 全局异常过滤器和响应拦截器
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger API文档
  const config = new DocumentBuilder()
    .setTitle('Aladdin AI Services API')
    .setDescription('Aladdin Agent接单平台后端API文档')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 启动应用
  const port = configService.get('port') ?? 3000;
  await app.listen(port);
  logger.log(`应用已启动，监听端口: ${port}`);
}

bootstrap().catch((error) => {
  console.error('应用启动失败:', error);
  process.exit(1);
});
