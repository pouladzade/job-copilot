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
exports.SaveApplicationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const constants_1 = require("../constants");
const application_draft_dto_1 = require("./application-draft.dto");
class SaveApplicationDto {
    status;
    resumeSummary;
    coverLetter;
    screeningAnswers;
    notes;
}
exports.SaveApplicationDto = SaveApplicationDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Application status', enum: constants_1.APPLICATION_STATUSES }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(constants_1.APPLICATION_STATUSES),
    __metadata("design:type", String)
], SaveApplicationDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'User-edited professional summary' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveApplicationDto.prototype, "resumeSummary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'User-edited cover letter' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveApplicationDto.prototype, "coverLetter", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'User-edited screening answers', type: [application_draft_dto_1.ScreeningAnswerDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => application_draft_dto_1.ScreeningAnswerDto),
    __metadata("design:type", Array)
], SaveApplicationDto.prototype, "screeningAnswers", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional notes about this application' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveApplicationDto.prototype, "notes", void 0);
//# sourceMappingURL=save-application.dto.js.map