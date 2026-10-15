import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'adflow.token';

/**
 * Demo authentication. A real deployment would obtain a JWT from an identity provider;
 * here a synthetic token is enough for the mock API and for a dev NestJS instance.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly _token = signal<string | null>(this.read());

  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  signInDemo(): void {
    this.set('demo-advertiser-token');
  }

  signOut(): void {
    this.set(null);
  }

  private set(token: string | null): void {
    this._token.set(token);
    if (!this.isBrowser) return;
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  }

  private read(): string | null {
    return this.isBrowser ? localStorage.getItem(STORAGE_KEY) : null;
  }
}
