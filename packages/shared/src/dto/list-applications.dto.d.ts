import type { ApplicationStatus } from '../constants';
export declare class ListApplicationsQueryDto {
    readonly company?: string;
    readonly status?: ApplicationStatus;
    readonly resumeUsed?: string;
    readonly page?: number;
    readonly limit?: number;
}
export declare class ListApplicationsResponseDto {
    readonly total: number;
    readonly page: number;
    readonly totalPages: number;
    readonly applications: ReadonlyArray<Record<string, unknown>>;
}
//# sourceMappingURL=list-applications.dto.d.ts.map