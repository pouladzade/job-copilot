import type { ApplicationStatus } from '../constants';
import { ScreeningAnswerDto } from './application-draft.dto';
export declare class SaveApplicationDto {
    readonly status: ApplicationStatus;
    readonly resumeSummary: string;
    readonly coverLetter: string;
    readonly screeningAnswers: ScreeningAnswerDto[];
    readonly notes?: string;
}
//# sourceMappingURL=save-application.dto.d.ts.map