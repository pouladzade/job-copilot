"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationDraftDto = exports.TokenUsageDto = exports.ScreeningAnswerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ScreeningAnswerDto {
    questionId;
    question;
    answer;
    confidence;
    confidenceTier;
}
exports.ScreeningAnswerDto = ScreeningAnswerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Stable hash of the question text for form-field mapping' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScreeningAnswerDto.prototype, "questionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The original question text from the job posting' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScreeningAnswerDto.prototype, "question", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The generated answer' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScreeningAnswerDto.prototype, "answer", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Confidence score from 0.0 to 1.0' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1),
    __metadata("design:type", Number)
], ScreeningAnswerDto.prototype, "confidence", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Confidence tier: low, medium, or high' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScreeningAnswerDto.prototype, "confidenceTier", void 0);
class TokenUsageDto {
    promptTokens;
    completionTokens;
    totalTokens;
    estimatedCostUsd;
}
exports.TokenUsageDto = TokenUsageDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Prompt tokens used' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TokenUsageDto.prototype, "promptTokens", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Completion tokens used' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TokenUsageDto.prototype, "completionTokens", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total tokens used' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TokenUsageDto.prototype, "totalTokens", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Estimated cost in USD' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], TokenUsageDto.prototype, "estimatedCostUsd", void 0);
class ApplicationDraftDto {
    schemaVersion;
    resumeSummary;
    coverLetter;
    screeningAnswers;
    missingInformation;
    overallConfidence;
    overallConfidenceTier;
    resumeUsed;
    resumeSelectionReason;
    generatedAt;
    tokenUsage;
}
exports.ApplicationDraftDto = ApplicationDraftDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Schema version for migration support' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ApplicationDraftDto.prototype, "schemaVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'AI-generated professional summary tailored to the job' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplicationDraftDto.prototype, "resumeSummary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'AI-generated cover letter' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplicationDraftDto.prototype, "coverLetter", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Generated answers to screening questions', type: () => [ScreeningAnswerDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ScreeningAnswerDto),
    __metadata("design:type", Array)
], ApplicationDraftDto.prototype, "screeningAnswers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Questions the model could not answer', type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ApplicationDraftDto.prototype, "missingInformation", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Overall confidence score from 0.0 to 1.0' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1),
    __metadata("design:type", Number)
], ApplicationDraftDto.prototype, "overallConfidence", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Confidence tier: low, medium, or high' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplicationDraftDto.prototype, "overallConfidenceTier", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Filename of the resume used (e.g., backend.md)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplicationDraftDto.prototype, "resumeUsed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'How the resume was selected' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApplicationDraftDto.prototype, "resumeSelectionReason", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ISO 8601 timestamp of generation' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ApplicationDraftDto.prototype, "generatedAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Token usage and cost for this generation', type: () => TokenUsageDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => TokenUsageDto),
    __metadata("design:type", TokenUsageDto)
], ApplicationDraftDto.prototype, "tokenUsage", void 0);
//# sourceMappingURL=application-draft.dto.js.map