import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshTokenService } from './refresh-token.service';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, name } = dto;

    // Check for duplicate email
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      this.logger.warn(`Registration failed: email ${email} already exists`);
      throw new ConflictException('A user with this email already exists');
    }

    // Create user (password hashed by UserSchema pre-save hook)
    const user = await this.usersService.create({ email, password, name });

    // Generate tokens
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await this.refreshTokenService.createToken(user.id, user.email);

    this.logger.log(`User registered: ${email}`);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async login(user: { id: string; email: string; name: string }) {
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await this.refreshTokenService.createToken(user.id, user.email);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async refreshToken(user: { id: string; email: string }, oldTokenJwt: string) {
    // Rotate the refresh token (invalidate old, create new)
    const newRefreshToken = await this.refreshTokenService.rotateToken(
      oldTokenJwt,
      user.id,
      user.email,
    );

    if (!newRefreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });

    this.logger.debug(`Token refreshed for user ${user.email}`);

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    let email = dto.email;
    let name = dto.name;

    // Decode credential JWT payload if provided
    if (dto.credential && !email) {
      try {
        const parts = dto.credential.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
          const googlePayload = JSON.parse(payloadJson);
          if (googlePayload.email) {
            email = googlePayload.email;
            name = googlePayload.name || googlePayload.email.split('@')[0];
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to parse Google credential: ${(e as Error).message}`);
      }
    }

    if (!email) {
      throw new UnauthorizedException('Invalid Google authentication payload. Email is required.');
    }

    let user = await this.usersService.findByEmail(email);

    if (!user) {
      // Auto-create user with Google profile
      const randomPassword = `G_${Math.random().toString(36).slice(2)}_${Date.now()}!A1`;
      user = await this.usersService.create({
        email,
        password: randomPassword,
        name: name || email.split('@')[0],
      });
      this.logger.log(`Created new user via Google Sign-In: ${email}`);
    } else {
      this.logger.log(`User logged in via Google Sign-In: ${email}`);
    }

    return this.login({ id: user.id, email: user.email, name: user.name });
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllUserTokens(userId);
    this.logger.log(`User logged out: ${userId}`);
  }

  async validateUser(email: string, password: string): Promise<{ id: string; email: string; name: string } | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
