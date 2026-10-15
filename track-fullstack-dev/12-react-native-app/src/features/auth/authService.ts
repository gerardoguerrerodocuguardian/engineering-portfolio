export interface AuthService {
  /** Resolves with a session token or rejects with InvalidCredentialsError. */
  login(email: string, password: string): Promise<string>;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

/** Mock: any advertiser@... account with password "adflow-demo" signs in. No real auth exists. */
export function createMockAuthService(token: string): AuthService {
  return {
    login: async (email, password) => {
      if (password !== 'adflow-demo' || !email.includes('@')) throw new InvalidCredentialsError();
      return token;
    },
  };
}
