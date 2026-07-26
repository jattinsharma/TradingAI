import { Module, Global } from '@nestjs/common';
import { PinoLoggerService } from './pino-logger.service';

@Global()
@Module({
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class LoggerModule {}
