import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';

export class GenerateTestDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsInt()
  @Min(1)
  @Max(180)
  duration: number; // in minutes

  @IsInt()
  @Min(1)
  @Max(50)
  questionCount: number;

  @IsOptional()
  @IsString()
  difficulty?: string;
}
