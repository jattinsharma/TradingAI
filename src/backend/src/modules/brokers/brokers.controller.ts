import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { BrokersService } from './brokers.service';

@Controller('brokers')
export class BrokersController {
  constructor(private readonly brokersService: BrokersService) {}

  @Get()
  findAll() {
    return this.brokersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.brokersService.findOne(id);
  }

  @Post()
  create(
    @Body() createBrokerDto: { name: string; type: string; apiKey?: string; apiSecret?: string; isActive?: boolean },
  ) {
    return this.brokersService.create(createBrokerDto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateBrokerDto: { name?: string; type?: string; apiKey?: string; apiSecret?: string; isActive?: boolean },
  ) {
    return this.brokersService.update(id, updateBrokerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.brokersService.remove(id);
  }

  @Post(':id/connect')
  connect(@Param('id') id: string) {
    return this.brokersService.connect(id);
  }

  @Post(':id/disconnect')
  disconnect(@Param('id') id: string) {
    return this.brokersService.disconnect(id);
  }
}
