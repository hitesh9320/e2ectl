import type { ProfileConfig } from '../types/config.js';

export interface CredentialValidationResult {
  message?: string;
  valid: boolean;
}

export interface CredentialValidator {
  validate(profile: ProfileConfig): Promise<CredentialValidationResult>;
}

export class DeferredCredentialValidator implements CredentialValidator {
  validate(profile: ProfileConfig): Promise<CredentialValidationResult> {
    void profile;

    return Promise.resolve({
      valid: true,
      message:
        'Live credential validation will be connected when the API client lands in M2.'
    });
  }
}
