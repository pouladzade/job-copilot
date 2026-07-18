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
exports.JobPostingDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class JobPostingDto {
    schemaVersion;
    title;
    company;
    location;
    description;
    sourceUrl;
    sourceSite;
    resumeHint;
}
exports.JobPostingDto = JobPostingDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Schema version for migration support' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Equals)(1),
    __metadata("design:type", Number)
], JobPostingDto.prototype, "schemaVersion", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job title', maxLength: 500 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], JobPostingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Company name', maxLength: 200 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], JobPostingDto.prototype, "company", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Job location', maxLength: 200 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], JobPostingDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Combined job description and requirements', maxLength: 50000 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(50000),
    __metadata("design:type", String)
], JobPostingDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Source URL of the job posting', maxLength: 2048 }),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.MaxLength)(2048),
    __metadata("design:type", String)
], JobPostingDto.prototype, "sourceUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Adapter ID (e.g., greenhouse, linkedin)', maxLength: 50 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], JobPostingDto.prototype, "sourceSite", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional explicit resume filename hint', maxLength: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", Object)
], JobPostingDto.prototype, "resumeHint", void 0);
//# sourceMappingURL=job-posting.dto.js.map