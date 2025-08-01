import {
  AuthManagerInterface,
  AuthenticationType,
  Credentials,
  AuthHeaders,
  AuthConfig,
} from './types.js';
import { BearerTokenAuth } from './bearer.js';
import { OAuth2Auth, OAuth2Config } from './oauth2.js';
import { SecureCredentialStore } from './store.js';
import { ProductboardAPIError } from '@api/errors.js';
import { Logger } from '@utils/logger.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export class AuthenticationManager implements AuthManagerInterface {
  private authType: AuthenticationType;
  private store: SecureCredentialStore;
  private bearerAuth?: BearerTokenAuth;
  private oauth2Auth?: OAuth2Auth;
  private logger: Logger;
  private baseUrl: string;

  constructor(config: AuthConfig, logger: Logger) {
    this.authType = config.type;
    this.store = new SecureCredentialStore();
    this.logger = logger;
    this.baseUrl = config.baseUrl || 'https://api.productboard.com';

    this.initializeAuthHandlers(config);
    this.loadSavedTokens();
  }

  private initializeAuthHandlers(config: AuthConfig): void {
    if (config.type === AuthenticationType.BEARER_TOKEN) {
      this.bearerAuth = new BearerTokenAuth(this.baseUrl);
    } else if (config.type === AuthenticationType.OAUTH2) {
      if (!config.credentials.clientId || !config.credentials.clientSecret) {
        throw new ProductboardAPIError(
          'OAuth2 credentials (clientId and clientSecret) are required',
          'AUTH_CONFIG_ERROR',
        );
      }

      const oauth2Config: OAuth2Config = {
        clientId: config.credentials.clientId,
        clientSecret: config.credentials.clientSecret,
        authorizationEndpoint: config.authorizationEndpoint || `${this.baseUrl}/oauth2/authorize`,
        tokenEndpoint: config.tokenEndpoint || `${this.baseUrl}/oauth2/token`,
        redirectUri: 'http://localhost:3000/callback',
      };

      this.oauth2Auth = new OAuth2Auth(oauth2Config);
    }
  }

  private loadSavedTokens(): void {
    if (this.authType !== AuthenticationType.OAUTH2) {
      this.logger.debug('Skipping token loading - not OAuth2 mode');
      return;
    }

    try {
      // Try multiple potential locations for the tokens file
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const potentialPaths = [
        resolve(process.cwd(), '.pb.tokens'),
        resolve(__dirname, '..', '..', '.pb.tokens'), // relative to dist directory
        resolve(process.env.HOME || '~', '.pb.tokens'), // fallback to home directory
      ];
      
      let tokensPath: string | null = null;
      for (const path of potentialPaths) {
        this.logger.debug(`Checking for tokens at: ${path}`);
        if (existsSync(path)) {
          tokensPath = path;
          break;
        }
      }
      
      if (tokensPath) {
        this.logger.debug(`Found tokens at: ${tokensPath}`);
        const tokenData = JSON.parse(readFileSync(tokensPath, 'utf-8'));
        const expiresAt = new Date(tokenData.expiresAt);
        const now = new Date();
        
        this.logger.debug(`Token expires at: ${expiresAt.toISOString()}, current time: ${now.toISOString()}, expired: ${expiresAt <= now}`);
        
        // Only load if token hasn't expired
        if (expiresAt > now) {
          const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
          this.logger.debug(`Loading token that expires in ${expiresInSeconds} seconds`);
          
          this.store.updateAccessToken(tokenData.accessToken, expiresInSeconds);
          if (tokenData.refreshToken) {
            this.store.updateRefreshToken(tokenData.refreshToken);
            this.logger.debug('Loaded refresh token');
          }
          
          // Set OAuth2 credentials so validation passes
          this.store.setCredentials({
            type: AuthenticationType.OAUTH2,
            clientId: process.env.PRODUCTBOARD_OAUTH_CLIENT_ID,
            clientSecret: process.env.PRODUCTBOARD_OAUTH_CLIENT_SECRET,
          });
          
          this.logger.info('Successfully loaded saved OAuth2 tokens');
        } else {
          this.logger.warn('Saved OAuth2 tokens have expired');
        }
      } else {
        this.logger.debug('No tokens file found in any expected location');
      }
    } catch (error) {
      this.logger.error('Failed to load saved OAuth2 tokens:', error);
    }
  }

  private async saveTokensToFile(accessToken: string, refreshToken: string | undefined, expiresIn: number): Promise<void> {
    try {
      const tokensPath = resolve(process.cwd(), '.pb.tokens');
      const tokenData = {
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      writeFileSync(tokensPath, JSON.stringify(tokenData, null, 2));
      this.logger.debug('Saved refreshed tokens to file');
    } catch (error) {
      this.logger.error('Failed to save refreshed tokens to file:', error);
      // Don't throw - token refresh succeeded, file save is just for persistence
    }
  }

  setCredentials(credentials: Credentials): void {
    this.store.setCredentials(credentials);
    this.logger.debug('Credentials updated');
  }

  async validateCredentials(): Promise<boolean> {
    const credentials = this.store.getCredentials();
    if (!credentials) {
      throw new ProductboardAPIError('No credentials set', 'AUTH_NO_CREDENTIALS');
    }

    try {
      if (this.authType === AuthenticationType.BEARER_TOKEN) {
        if (!credentials.token) {
          throw new ProductboardAPIError('Bearer token is required', 'AUTH_NO_TOKEN');
        }
        return await this.bearerAuth!.validateToken(credentials.token);
      } else if (this.authType === AuthenticationType.OAUTH2) {
        if (this.store.isTokenExpired()) {
          await this.refreshCredentials();
        }
        const cache = this.store.getTokenCache();
        return !!cache.accessToken;
      }

      return false;
    } catch (error) {
      this.logger.error('Credential validation failed', error);
      throw error;
    }
  }

  async refreshCredentials(): Promise<void> {
    if (this.authType !== AuthenticationType.OAUTH2) {
      throw new ProductboardAPIError(
        'Token refresh is only available for OAuth2',
        'AUTH_REFRESH_NOT_SUPPORTED',
      );
    }

    const cache = this.store.getTokenCache();
    if (!cache.refreshToken) {
      throw new ProductboardAPIError('No refresh token available', 'AUTH_NO_REFRESH_TOKEN');
    }

    try {
      const tokenResponse = await this.oauth2Auth!.refreshToken(cache.refreshToken);
      this.store.updateAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
      if (tokenResponse.refresh_token) {
        this.store.updateRefreshToken(tokenResponse.refresh_token);
      }
      
      // Persist refreshed tokens to file for laptop reboots/restarts
      await this.saveTokensToFile(tokenResponse.access_token, tokenResponse.refresh_token, tokenResponse.expires_in);
      
      this.logger.info('OAuth2 tokens refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh OAuth2 tokens', error);
      throw error;
    }
  }

  getAuthHeaders(): AuthHeaders {
    const credentials = this.store.getCredentials();
    if (!credentials) {
      throw new ProductboardAPIError('No credentials set', 'AUTH_NO_CREDENTIALS');
    }

    if (this.authType === AuthenticationType.BEARER_TOKEN) {
      if (!credentials.token) {
        throw new ProductboardAPIError('Bearer token is required', 'AUTH_NO_TOKEN');
      }
      return this.bearerAuth!.getHeaders(credentials.token);
    } else if (this.authType === AuthenticationType.OAUTH2) {
      const cache = this.store.getTokenCache();
      if (!cache.accessToken) {
        throw new ProductboardAPIError('No access token available', 'AUTH_NO_ACCESS_TOKEN');
      }
      return this.oauth2Auth!.getHeaders(cache.accessToken);
    }

    throw new ProductboardAPIError('Unsupported authentication type', 'AUTH_TYPE_ERROR');
  }

  isTokenExpired(): boolean {
    if (this.authType === AuthenticationType.BEARER_TOKEN) {
      return false;
    }
    return this.store.isTokenExpired();
  }

  getTokenExpiry(): Date | null {
    if (this.authType === AuthenticationType.BEARER_TOKEN) {
      return null;
    }
    return this.store.getTokenExpiry();
  }

  async handleOAuth2Callback(code: string, state: string): Promise<void> {
    if (this.authType !== AuthenticationType.OAUTH2) {
      throw new ProductboardAPIError(
        'OAuth2 callback is only available for OAuth2 authentication',
        'AUTH_CALLBACK_NOT_SUPPORTED',
      );
    }

    if (!this.oauth2Auth!.validateState(state)) {
      throw new ProductboardAPIError('Invalid OAuth2 state parameter', 'AUTH_INVALID_STATE');
    }

    try {
      const tokenResponse = await this.oauth2Auth!.exchangeCodeForToken(code);
      this.store.updateAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
      if (tokenResponse.refresh_token) {
        this.store.updateRefreshToken(tokenResponse.refresh_token);
      }
      this.logger.info('OAuth2 authorization completed successfully');
    } catch (error) {
      this.logger.error('OAuth2 callback failed', error);
      throw error;
    }
  }

  getOAuth2AuthorizationUrl(): string {
    if (this.authType !== AuthenticationType.OAUTH2) {
      throw new ProductboardAPIError(
        'Authorization URL is only available for OAuth2',
        'AUTH_URL_NOT_SUPPORTED',
      );
    }
    return this.oauth2Auth!.getAuthorizationUrl();
  }
}