import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../../database/schemas/refresh-token.schema';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectModel(RefreshToken.name)
    private readonly model: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Create a new refresh token for a user.
   * The token is signed as a JWT and stored in MongoDB.
   * Returns the JWT string.
   */
  async createToken(userId: string, email: string): Promise<string> {
    const payload = { sub: userId, email };
    const token = this.jwtService.sign(payload, { expiresIn: '7d' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.model.create({
      userId,
      token,
      expiresAt,
      isRevoked: false,
    });

    this.logger.debug(`Refresh token created for user ${userId}`);
    return token;
  }

  /**
   * Rotate a refresh token: invalidate the old one and create a new one.
   * Returns the new token JWT string, or null if the old token is invalid.
   */
  async rotateToken(
    oldTokenJwt: string,
    userId: string,
    email: string,
  ): Promise<string | null> {
    // Find the old token in DB
    const oldToken = await this.model.findOne({
      token: oldTokenJwt,
      userId,
      isRevoked: false,
    });

    if (!oldToken) {
      return null;
    }

    // Check if expired
    if (oldToken.expiresAt < new Date()) {
      return null;
    }

    // Revoke the old token
    oldToken.isRevoked = true;
    await oldToken.save();

    // Revoke all other tokens for this user (one-active-token policy)
    await this.model.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    // Create a new token
    return this.createToken(userId, email);
  }

  /**
   * Revoke all refresh tokens for a user (logout).
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.model.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
    this.logger.debug(`All refresh tokens revoked for user ${userId}`);
  }

  /**
   * Revoke a specific refresh token.
   */
  async revokeToken(tokenJwt: string): Promise<void> {
    await this.model.updateOne({ token: tokenJwt }, { isRevoked: true });
  }

  /**
   * Clean up expired tokens from the database.
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.model.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    if (result.deletedCount > 0) {
      this.logger.log(`Cleaned up ${result.deletedCount} expired refresh tokens`);
    }
    return result.deletedCount || 0;
  }

  /**
   * Get the count of active (non-revoked, non-expired) tokens for a user.
   */
  async getActiveTokenCount(userId: string): Promise<number> {
    return this.model.countDocuments({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });
  }
}
