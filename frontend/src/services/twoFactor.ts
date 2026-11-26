import { api } from './api';
import type {
  EnableTwoFactorRequest,
  EnableTwoFactorResponse,
  TwoFactorSetupResponse,
} from '../types/twoFactor';

// Use the real session, CSRF protection and authenticated user, not the branch's temporary user ID.
export function startTwoFactorSetup(): Promise<TwoFactorSetupResponse> {
  return api<TwoFactorSetupResponse>('auth/2fa/setup', {});
}
export function enableTwoFactor(request: EnableTwoFactorRequest): Promise<EnableTwoFactorResponse> {
  return api<EnableTwoFactorResponse>('auth/2fa/enable', { code: request.code });
}
