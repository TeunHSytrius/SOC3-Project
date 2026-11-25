export interface TwoFactorSetupResponse {
  otpAuthUri: string;
  manualEntryKey: string;
}

export interface EnableTwoFactorRequest {
  code: string;
}

export interface EnableTwoFactorResponse {
  recoveryCodes: string[];
}
