import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { TokenUsageLog } from './token-usage-log.entity';

export interface ScreeningAnswerRecord {
  questionId: string;
  question: string;
  answer: string;
  confidence: number;
  confidenceTier: 'low' | 'medium' | 'high';
}

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn()
  readonly id!: number;

  @Column({ type: 'int', default: 1 })
  readonly schemaVersion!: number;

  @Index('idx_applications_company')
  @Column({ type: 'varchar', length: 200 })
  readonly company!: string;

  @Column({ type: 'varchar', length: 300 })
  readonly role!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  readonly location!: string | null;

  @Column({ type: 'varchar', length: 2048, unique: true })
  readonly sourceUrl!: string;

  @Column({ type: 'varchar', length: 50 })
  readonly sourceSite!: string;

  @Index('idx_applications_resume_used')
  @Column({ type: 'varchar', length: 100 })
  readonly resumeUsed!: string;

  @Column({ type: 'varchar', length: 50 })
  readonly resumeSelectionReason!: string;

  @Column({ type: 'text', nullable: true })
  readonly resumeSummary!: string | null;

  @Column({ type: 'text', nullable: true })
  readonly coverLetter!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  readonly screeningAnswers!: ScreeningAnswerRecord[] | null;

  @Column({ type: 'real', nullable: true })
  readonly overallConfidence!: number | null;

  @Index('idx_applications_status')
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  readonly status!: 'draft' | 'submitted' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

  @Column({ type: 'text', nullable: true })
  readonly notes!: string | null;

  @Index('idx_applications_created_at')
  @CreateDateColumn({ type: 'timestamp' })
  readonly createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  readonly updatedAt!: Date;

  @OneToMany(() => TokenUsageLog, (log) => log.application)
  readonly tokenUsageLogs!: TokenUsageLog[];
}