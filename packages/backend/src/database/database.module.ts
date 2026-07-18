import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from './entities/application.entity';
import { TokenUsageLog } from './entities/token-usage-log.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env['DB_HOST'] ?? 'localhost',
      port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
      username: process.env['DB_USER'] ?? 'jobhunter',
      password: process.env['DB_PASSWORD'] ?? 'jobhunter',
      database: process.env['DB_NAME'] ?? 'jobhunter',
      entities: [Application, TokenUsageLog],
      synchronize: process.env['NODE_ENV'] !== 'production',
      logging: process.env['NODE_ENV'] === 'development',
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}