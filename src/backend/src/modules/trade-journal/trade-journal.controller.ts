import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TradeJournalService } from './trade-journal.service';

@ApiTags('Trade Journal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trade-journal')
export class TradeJournalController {
  constructor(private readonly journalService: TradeJournalService) {}

  @Post()
  @ApiOperation({ summary: 'Record a new trade entry' })
  @ApiBody({ schema: { type: 'object', properties: { symbol: { type: 'string' }, side: { type: 'string' }, entryPrice: { type: 'number' }, reason: { type: 'string' }, emotion: { type: 'string' }, mistakes: { type: 'string' }, lessons: { type: 'string' } } } })
  async create(@Body() data: Record<string, unknown>) {
    return this.journalService.create(data);
  }

  @Get()
  @ApiOperation({ summary: 'List trade journal entries with filters' })
  @ApiQuery({ name: 'symbol', required: false })
  @ApiQuery({ name: 'result', required: false })
  @ApiQuery({ name: 'side', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAll(
    @Query('symbol') symbol?: string,
    @Query('result') result?: string,
    @Query('side') side?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
  ) {
    return this.journalService.findAll({ symbol, result, side, startDate, endDate, limit });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get trade journal statistics (win rate, P&L, etc.)' })
  async getStats() {
    return this.journalService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one trade entry by ID' })
  async findOne(@Param('id') id: string) {
    return this.journalService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a trade journal entry' })
  async update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.journalService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a trade journal entry' })
  async remove(@Param('id') id: string) {
    return this.journalService.remove(id);
  }
}
