import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: { email: string; password: string; name: string }) {
    const { email, password, name } = registerDto;

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      this.logger.warn(`Registration failed: email ${email} already exists`);
      throw new UnauthorizedException('A user with this email already exists');
    }

    const user = await this.usersService.create({ email, password, name });

    const payload = { email: user.email, sub: user.id };
    const token = this.jwtService.sign(payload);

    this.logger.log(`User registered: ${email}`);

    return {
      access_token: token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login(user: { id: string; email: string; name: string }) {
    const payload = { email: user.email, sub: user.id };

    this.logger.log(`User logged in: ${user.email}`);

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '60m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async refreshToken(user: { id: string; email: string }) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '60m' }),
    };
  }

  async validateUser(email: string, password: string): Promise<{ id: string; email: string; name: string } | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    const { password: _pwd, ...result } = user;
    return result;
  }
}
