import { Injectable, NotFoundException } from '@nestjs/common';

export interface Broker {
  id: string;
  name: string;
  type: string; // e.g., 'binance', 'coinbase', 'kraken', 'zerodha', etc.
  apiKey?: string;
  apiSecret?: string;
  isActive: boolean;
  connected: boolean;
  lastConnected?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BrokersService {
  private brokers: Broker[] = [];

  constructor() {
    // Initialize with some sample brokers
    this.initializeSampleBrokers();
  }

  private initializeSampleBrokers() {
    const sampleBrokers: Broker[] = [
      {
        id: '1',
        name: 'Binance Main Account',
        type: 'binance',
        isActive: true,
        connected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: 'Coinbase Pro',
        type: 'coinbase',
        isActive: true,
        connected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        name: 'Zerodha Trading Account',
        type: 'zerodha',
        isActive: true,
        connected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    this.brokers = [...this.brokers, ...sampleBrokers];
  }

  findAll(): Broker[] {
    return this.brokers;
  }

  findOne(id: string): Broker {
    const broker = this.brokers.find((broker) => broker.id === id);
    if (!broker) {
      throw new NotFoundException(`Broker with ID ${id} not found`);
    }
    return broker;
  }

  create(createBrokerDto: {
    name: string;
    type: string;
    apiKey?: string;
    apiSecret?: string;
    isActive?: boolean;
  }): Broker {
    const broker: Broker = {
      id: Date.now().toString(),
      name: createBrokerDto.name,
      type: createBrokerDto.type,
      apiKey: createBrokerDto.apiKey,
      apiSecret: createBrokerDto.apiSecret,
      isActive: createBrokerDto.isActive ?? true,
      connected: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.brokers.push(broker);
    return broker;
  }

  update(
    id: string,
    updateBrokerDto: {
      name?: string;
      type?: string;
      apiKey?: string;
      apiSecret?: string;
      isActive?: boolean;
    },
  ): Broker {
    const brokerIndex = this.brokers.findIndex((broker) => broker.id === id);
    if (brokerIndex === -1) {
      throw new NotFoundException(`Broker with ID ${id} not found`);
    }

    this.brokers[brokerIndex] = {
      ...this.brokers[brokerIndex],
      ...updateBrokerDto,
      updatedAt: new Date(),
    };

    return this.brokers[brokerIndex];
  }

  remove(id: string): Broker {
    const brokerIndex = this.brokers.findIndex((broker) => broker.id === id);
    if (brokerIndex === -1) {
      throw new NotFoundException(`Broker with ID ${id} not found`);
    }

    const [deletedBroker] = this.brokers.splice(brokerIndex, 1);
    return deletedBroker;
  }

  connect(id: string): { success: boolean; message: string } {
    const broker = this.findOne(id);
    broker.connected = true;
    broker.lastConnected = new Date();
    broker.updatedAt = new Date();

    return {
      success: true,
      message: `Successfully connected to ${broker.name}`,
    };
  }

  disconnect(id: string): { success: boolean; message: string } {
    const broker = this.findOne(id);
    broker.connected = false;
    broker.updatedAt = new Date();

    return {
      success: true,
      message: `Successfully disconnected from ${broker.name}`,
    };
  }
}
