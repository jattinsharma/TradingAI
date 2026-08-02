import { Module, Global } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AIProviderModule } from '../providers/ai/ai-provider.module';

@Global()
@Module({
  imports: [AIProviderModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}