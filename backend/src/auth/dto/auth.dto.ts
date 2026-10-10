import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidationArguments,
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { validatePasswordStrength, MAX_PASSWORD_LENGTH } from '../../common/security/password-policy.js';

/** Enforces the password policy, including the identity check. */
@ValidatorConstraint({ name: 'isStrongPassword', async: false })
class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const object = (args.object ?? {}) as { email?: string; fullname?: string };
    return validatePasswordStrength(String(value ?? ''), {
      email: object.email,
      fullname: object.fullname,
    }).ok;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = (args.object ?? {}) as { email?: string; fullname?: string };
    const { errors } = validatePasswordStrength(String(args.value ?? ''), {
      email: object.email,
      fullname: object.fullname,
    });
    return errors.length ? errors.join('; ') : 'Password does not meet the security policy';
  }
}

export function IsStrongPassword(validationOptions?: { message?: string }) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: StrongPasswordConstraint,
    });
  };
}

/** Trims and lower-cases an email so the database CHECK constraint always holds. */
const NormalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class RegisterDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  @NormalizeEmail()
  email: string;

  @IsString()
  @IsStrongPassword()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullname: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

export class LoginDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  @NormalizeEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'A valid email address is required' })
  @MaxLength(254)
  @NormalizeEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsString()
  @IsStrongPassword()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword: string;

  @IsString()
  @IsStrongPassword()
  @MaxLength(MAX_PASSWORD_LENGTH)
  newPassword: string;
}
