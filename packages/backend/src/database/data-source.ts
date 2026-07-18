import { DataSource } from 'typeorm';
import { Application } from './entities/application.entity';
import { TokenUsageLog } from './entities/token-usage-log.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5433', 10),
  username: process.env['DB_USER'] ?? 'jobhunter',
  password: process.env['DB_PASSWORD'] ?? 'jobhunter',
  database: process.env['DB_NAME'] ?? 'jobhunter',
  entities: [Application, TokenUsageLog],
  migrations: [__dirname + '/migrations/*.ts'],
  synchronize: process.env['NODE_ENV'] !== 'production',
  logging: process.env['NODE_ENV'] === 'development',
});