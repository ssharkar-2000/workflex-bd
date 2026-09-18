import { Module } from '@nestjs/common';
import { ImageQualityService } from './image-quality.service';
import { OcrService } from './ocr.service';
import { FaceService } from './face.service';
import { AnalysisService } from './analysis.service';

@Module({
  providers: [ImageQualityService, OcrService, FaceService, AnalysisService],
  exports: [AnalysisService, OcrService],
})
export class VerificationModule {}
