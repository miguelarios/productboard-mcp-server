import { AuthHeaders } from './types.js';
import { ProductboardAPIError } from '@api/errors.js';
import axios, { AxiosError } from 'axios';

export class BearerTokenAuth {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/users/current`, {
        headers: this.getHeaders(token),
        timeout: 5000,
      });

      return response.status === 200;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        return false;
      }
      throw new ProductboardAPIError(
        'Failed to validate bearer token',
        'AUTH_VALIDATION_ERROR',
        error instanceof Error ? error : undefined,
      );
    }
  }

  getHeaders(token: string): AuthHeaders {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}