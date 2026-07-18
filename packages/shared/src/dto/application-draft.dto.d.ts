import type { ConfidenceTier, ResumeSelectionReason } from '../constants';
export declare class ScreeningAnswerDto {
    readonly questionId: string;
    readonly question: string;
    readonly answer: string;
    readonly confidence: number;
    readonly confidenceTier: ConfidenceTier;
}
export declare class TokenUsageDto {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly estimatedCostUsd: number;
}
export declare class ApplicationDraftDto {
    readonly schemaVersion: number;
    readonly resumeSummary: string;
    readonly coverLetter: string;
    readonly screeningAnswers: ScreeningAnswerDto[];
    readonly missingInformation: string[];
    readonly overallConfidence: number;
    readonly overallConfidenceTier: ConfidenceTier;
    readonly resumeUsed: string;
    readonly resumeSelectionReason: ResumeSelectionReason;
    readonly generatedAt: string;
    readonly tokenUsage: TokenUsageDto;
}
//# sourceMappingURL=application-draft.dto.d.ts.map