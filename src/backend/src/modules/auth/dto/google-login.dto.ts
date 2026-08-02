import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ example: 'user@gmail.com', description: 'User Google email', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'John Doe', description: 'Display name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '109283749281739', description: 'Google User ID', required: false })
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiProperty({ example: 'https://lh3.googleusercontent.com/...', description: 'Profile picture URL', required: false })
  @IsOptional()
  @IsString()
  picture?: string;

  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIs...', description: 'Google ID token or OAuth credential', required: false })
  @IsOptional()
  @IsString()
  credential?: string;
}
