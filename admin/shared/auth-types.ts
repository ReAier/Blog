export type SecondFactorInput =
  | { type: 'totp'; code: string }
  | { type: 'recovery-code'; code: string };

export interface LoginRequest {
  username: string;
  password: string;
  secondFactor: SecondFactorInput;
  remoteAddress: string;
}

export interface AuthenticatedSession {
  id: number;
  adminId: number;
  token: string;
  csrfToken: string;
  createdAt: number;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
}

export type LoginResult =
  | {
      ok: true;
      secondFactor: SecondFactorInput['type'];
      session: AuthenticatedSession;
    }
  | {
      ok: false;
      reason: 'invalid-credentials';
    }
  | {
      ok: false;
      reason: 'locked';
      retryAfterMs: number;
    };
