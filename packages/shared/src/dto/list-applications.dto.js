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
exports.ListApplicationsResponseDto = exports.ListApplicationsQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const constants_1 = require("../constants");
class ListApplicationsQueryDto {
    company;
    status;
    resumeUsed;
    page;
    limit;
}
exports.ListApplicationsQueryDto = ListApplicationsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by company name (ILIKE)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListApplicationsQueryDto.prototype, "company", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by application status', enum: constants_1.APPLICATION_STATUSES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(constants_1.APPLICATION_STATUSES),
    __metadata("design:type", String)
], ListApplicationsQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Filter by resume version used' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ListApplicationsQueryDto.prototype, "resumeUsed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Page number (1-based)', default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ListApplicationsQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Items per page (max 100)', default: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ListApplicationsQueryDto.prototype, "limit", void 0);
class ListApplicationsResponseDto {
    total;
    page;
    totalPages;
    applications;
}
exports.ListApplicationsResponseDto = ListApplicationsResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total number of matching applications' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ListApplicationsResponseDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current page number' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ListApplicationsResponseDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total number of pages' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ListApplicationsResponseDto.prototype, "totalPages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Applications for the current page' }),
    __metadata("design:type", Array)
], ListApplicationsResponseDto.prototype, "applications", void 0);
//# sourceMappingURL=list-applications.dto.js.map