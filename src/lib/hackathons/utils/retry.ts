/**
 * Exponential backoff options.
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Execute an asynchronous operation with bounded exponential backoff.
 */
export async function withExponentialBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 1;
  let lastError: unknown;

  while (attempt <= maxAttempts) {
    try {
      return await operation(attempt);
    } catch (err: unknown) {
      lastError = err;

      // Don't sleep if this was our last attempt
      if (attempt >= maxAttempts) {
        break;
      }

      // Check if this error is retryable
      if (options.shouldRetry && !options.shouldRetry(err, attempt)) {
        break;
      }

      // Compute delay with exponential backoff + jitter (±20%)
      const baseDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      const jitter = (Math.random() * 0.4 - 0.2) * baseDelay;
      const delay = Math.min(maxDelayMs, Math.max(0, Math.floor(baseDelay + jitter)));

      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw lastError;
}

/**
 * Helper to determine if an HTTP status code is transient/retryable.
 */
export function isRetryableHttpStatus(status: number): boolean {
  // 408 Request Timeout, 429 Too Many Requests, and 5xx Server Errors
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}
