import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors([
    'http://localhost:5173',
    'http://localhost:3000',
  ],); // allow frontend
  await app.listen(3001); // frontend is probably on 3000
}
bootstrap();
