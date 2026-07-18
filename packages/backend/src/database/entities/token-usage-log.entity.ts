import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Application } from './application.entity';

@Entity('token_usage_log')
export class TokenUsageLog {
  @PrimaryGeneratedColumn()
  readonly id!: number;

  @Column({ type: 'int', nullable: true })
  readonly applicationId!: number | null;

  @Column({ type: 'varchar', length: 50 })
  readonly model!: string;

  @Column({ type: 'int' })
  readonly promptTokens!: number;

  @Column({ type: 'int' })
  readonly completionTokens!: number;

  @Column({ type: 'int' })
  readonly totalTokens!: number;

  @Column({ type: 'real' })
  readonly estimatedCostUsd!: number;

  @CreateDateColumn({ type: 'timestamp' })
  readonly createdAt!: Date;

  @ManyToOne(() => Application, (app) => app.tokenUsageLogs, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'application_id' })
  readonly application!: Application | null;
}