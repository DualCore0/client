import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  subject?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
