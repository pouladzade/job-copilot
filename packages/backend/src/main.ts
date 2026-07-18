import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
// import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { BACKEND_PORT, REQUEST_SIZE_LIMIT_BYTES } from '@job-hunter/shared';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: [/^chrome-extension:\/\//],
    methods: ['GET', 'POST', 'PATCH'],
    maxAge: 86400,
  });

  app.use(json({ limit: '50kb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // const config = new DocumentBuilder()
  //   .setTitle('Job Hunter Agent API')
  //   .setDescription('Local API for the AI Job Copilot browser extension')
  //   .setVersion('0.1')
  //   .build();
  //
  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api/docs', app, document);

  await app.listen(BACKEND_PORT, '127.0.0.1');
  console.warn(`Backend listening on http://127.0.0.1:${BACKEND_PORT.toString()}`);
  console.warn(`Swagger docs at http://127.0.0.1:${BACKEND_PORT.toString()}/api/docs`);
}

void bootstrap();