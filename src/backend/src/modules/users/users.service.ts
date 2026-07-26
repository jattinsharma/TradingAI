import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../../database/schemas/user.schema';

export interface UserRecord {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt?: Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private readonly model: Model<UserDocument>,
  ) {}

  async create(createUserDto: { email: string; password: string; name: string }): Promise<UserRecord> {
    const created = new this.model({
      email: createUserDto.email,
      password: createUserDto.password, // UserSchema pre-save hook hashes this
      name: createUserDto.name,
    });

    const saved = await created.save();
    this.logger.log(`User created: ${saved.email}`);

    return this.toRecord(saved);
  }

  async findAll(): Promise<UserRecord[]> {
    const users = await this.model.find().exec();
    return users.map((u) => this.toRecord(u));
  }

  async findOne(id: string): Promise<UserRecord | undefined> {
    const user = await this.model.findById(id).exec();
    return user ? this.toRecord(user) : undefined;
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const user = await this.model.findOne({ email }).exec();
    return user ? this.toRecord(user) : undefined;
  }

  async update(id: string, updateUserDto: { email?: string; name?: string }): Promise<UserRecord> {
    const user = await this.model.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.email !== undefined) user.email = updateUserDto.email;
    if (updateUserDto.name !== undefined) user.name = updateUserDto.name;

    const saved = await user.save();
    return this.toRecord(saved);
  }

  async remove(id: string): Promise<UserRecord> {
    const user = await this.model.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.model.findByIdAndDelete(id).exec();
    return this.toRecord(user);
  }

  private toRecord(user: User): UserRecord {
    return {
      id: String(user._id),
      email: user.email,
      password: user.password,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
