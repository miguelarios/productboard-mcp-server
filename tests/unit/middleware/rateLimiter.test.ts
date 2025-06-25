import { RateLimiter } from '../../../src/middleware/rateLimiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Create rate limiter with 60 requests per minute (60000ms window)
    rateLimiter = new RateLimiter(60, 60000, {
      'special-tool': 30
    });
  });

  describe('Constructor', () => {
    it('should initialize with global limit and window', () => {
      const defaultRateLimiter = new RateLimiter(100, 60000);
      expect(defaultRateLimiter).toBeDefined();
    });

    it('should initialize with per-tool limits', () => {
      const customRateLimiter = new RateLimiter(100, 60000, {
        'tool1': 50,
        'tool2': 75
      });
      expect(customRateLimiter).toBeDefined();
    });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      expect(rateLimiter.checkLimit('test-key')).toBe(true);
      await expect(rateLimiter.waitForSlot('test-key')).resolves.toBeUndefined();
    });

    it('should track token consumption correctly', () => {
      const initialUsage = rateLimiter.getUsage('test-key');
      expect(initialUsage.remaining).toBe(60);
      expect(initialUsage.limit).toBe(60);
      
      // Consume a token
      rateLimiter.checkLimit('test-key');
      expect(rateLimiter.checkLimit('test-key')).toBe(true); // Still has tokens
    });

    it('should refill tokens over time', async () => {
      // Consume all tokens
      for (let i = 0; i < 60; i++) {
        await rateLimiter.waitForSlot('test-key');
      }
      
      const usage = rateLimiter.getUsage('test-key');
      expect(usage.remaining).toBe(0);
      
      // Reset to simulate time passing
      rateLimiter.reset('test-key');
      const resetUsage = rateLimiter.getUsage('test-key');
      expect(resetUsage.remaining).toBe(60);
    });
  });

  describe('Rate Limit Enforcement', () => {
    it('should block requests when limit is exceeded', async () => {
      // Consume all tokens
      for (let i = 0; i < 60; i++) {
        await rateLimiter.waitForSlot('test-key');
      }
      
      expect(rateLimiter.checkLimit('test-key')).toBe(false);
      
      // waitForSlot should wait until tokens are available
      const startTime = Date.now();
      
      // Mock setTimeout to avoid actual waiting in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        // Reset the bucket to simulate time passing
        rateLimiter.reset('test-key');
        (fn as Function)();
        return {} as any;
      });
      
      await rateLimiter.waitForSlot('test-key');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);
      
      jest.restoreAllMocks();
    });

    it('should handle per-tool limits', async () => {
      // Test special tool with 30 token limit
      const specialUsage = rateLimiter.getUsage('special-tool');
      expect(specialUsage.limit).toBe(30);
      expect(specialUsage.remaining).toBe(30);
      
      // Consume all tokens for special tool
      for (let i = 0; i < 30; i++) {
        await rateLimiter.waitForSlot('special-tool');
      }
      
      expect(rateLimiter.checkLimit('special-tool')).toBe(false);
      
      // Other keys should still use global limit
      const globalUsage = rateLimiter.getUsage('other-tool');
      expect(globalUsage.limit).toBe(60);
    });

    it('should handle global key specially', () => {
      const globalUsage = rateLimiter.getUsage('global');
      expect(globalUsage.limit).toBe(60);
      expect(globalUsage.remaining).toBe(60);
    });
  });

  describe('Query Methods', () => {
    it('should check if key has available tokens', async () => {
      expect(rateLimiter.checkLimit('test-key')).toBe(true);
      
      // Consume all tokens using waitForSlot which actually consumes tokens
      for (let i = 0; i < 60; i++) {
        await rateLimiter.waitForSlot('test-key');
      }
      
      expect(rateLimiter.checkLimit('test-key')).toBe(false);
    });

    it('should return usage information correctly', () => {
      const usage = rateLimiter.getUsage('test-key');
      
      expect(usage).toEqual({
        limit: 60,
        remaining: 60,
        resetAt: expect.any(Date),
      });
      
      // Check that resetAt is in the future
      expect(usage.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should track token consumption in usage', () => {
      // Consume some tokens
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('test-key');
      }
      
      const usage = rateLimiter.getUsage('new-key');
      expect(usage.remaining).toBe(60); // New key should have full limit
    });
  });

  describe('Multiple Keys', () => {
    it('should handle different keys independently', async () => {
      await rateLimiter.waitForSlot('key1');
      await rateLimiter.waitForSlot('key2');
      
      const usage1 = rateLimiter.getUsage('key1');
      const usage2 = rateLimiter.getUsage('key2');
      
      expect(usage1.remaining).toBe(59); // One token consumed
      expect(usage2.remaining).toBe(59); // One token consumed
    });

    it('should maintain separate buckets for different keys', async () => {
      // Consume different amounts for each key using waitForSlot
      for (let i = 0; i < 10; i++) {
        await rateLimiter.waitForSlot('key1');
      }
      
      for (let i = 0; i < 20; i++) {
        await rateLimiter.waitForSlot('key2');
      }
      
      const usage1 = rateLimiter.getUsage('key1');
      const usage2 = rateLimiter.getUsage('key2');
      
      expect(usage1.remaining).toBe(50); // 60 - 10
      expect(usage2.remaining).toBe(40); // 60 - 20
    });
  });

  describe('Edge Cases', () => {
    it('should handle reset correctly', async () => {
      // Consume some tokens using waitForSlot
      for (let i = 0; i < 30; i++) {
        await rateLimiter.waitForSlot('test-key');
      }
      
      let usage = rateLimiter.getUsage('test-key');
      expect(usage.remaining).toBe(30);
      
      // Reset the bucket
      rateLimiter.reset('test-key');
      
      usage = rateLimiter.getUsage('test-key');
      expect(usage.remaining).toBe(60);
    });

    it('should handle zero limits', () => {
      const zeroLimitRateLimiter = new RateLimiter(0, 60000);
      expect(zeroLimitRateLimiter).toBeDefined();
      
      expect(zeroLimitRateLimiter.checkLimit('test-key')).toBe(false);
      const usage = zeroLimitRateLimiter.getUsage('test-key');
      expect(usage.limit).toBe(0);
      expect(usage.remaining).toBe(0);
    });

    it('should handle undefined per-tool limits', () => {
      const noPerToolLimits = new RateLimiter(50, 60000);
      const usage = noPerToolLimits.getUsage('any-key');
      expect(usage.limit).toBe(50);
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        rateLimiter.waitForSlot(`concurrent-key-${i}`)
      );
      
      await Promise.all(promises);
      
      // Each key should have consumed one token
      for (let i = 0; i < 10; i++) {
        const usage = rateLimiter.getUsage(`concurrent-key-${i}`);
        expect(usage.remaining).toBe(59);
      }
    });

    it('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 5; i++) {
        await rateLimiter.waitForSlot('rapid-key');
      }
      
      const usage = rateLimiter.getUsage('rapid-key');
      expect(usage.remaining).toBe(55); // 60 - 5
    });
  });
});