import { Credentials, TokenCache } from './types.js';

export class SecureCredentialStore {
  private credentials: Credentials | null = null;
  private tokenCache: TokenCache = {};

  setCredentials(credentials: Credentials): void {
    this.credentials = { ...credentials };
  }

  getCredentials(): Credentials | null {
    return this.credentials ? { ...this.credentials } : null;
  }

  hasCredentials(): boolean {
    return this.credentials !== null;
  }

  clearCredentials(): void {
    this.credentials = null;
    this.tokenCache = {};
  }

  setTokenCache(cache: TokenCache): void {
    this.tokenCache = { ...cache };
  }

  getTokenCache(): TokenCache {
    return { ...this.tokenCache };
  }

  updateAccessToken(token: string, expiresIn: number): void {
    this.tokenCache.accessToken = token;
    this.tokenCache.expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  updateRefreshToken(token: string): void {
    this.tokenCache.refreshToken = token;
  }

  isTokenExpired(): boolean {
    if (!this.tokenCache.expiresAt) {
      return true;
    }
    return new Date() >= this.tokenCache.expiresAt;
  }

  getTokenExpiry(): Date | null {
    return this.tokenCache.expiresAt || null;
  }
}