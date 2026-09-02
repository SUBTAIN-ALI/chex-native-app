import { assertUploadResponseOk, isExpiredSignatureError, isNetworkLevelError, isRetryableError, markNonRetryable, withRetry } from '../src/Utils/retry';

const netError = () => Object.assign(new Error('Network request failed'), { isAxiosError: true, code: 'ERR_NETWORK' });
const httpError = status => Object.assign(new Error(`http ${status}`), { response: { status } });

let online = true;

beforeEach(() => {
  online = true;
  global.fetch = jest.fn(() => (online ? Promise.resolve({ status: 200 }) : Promise.reject(new Error('Network request failed'))));
});

describe('isRetryableError', () => {
  it('retries transport failures', () => {
    expect(isRetryableError(netError())).toBe(true);
    expect(isRetryableError(Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }))).toBe(true);
    expect(isRetryableError(new Error('java.net.SocketTimeoutException'))).toBe(true);
  });

  it('retries transient server failures', () => {
    [408, 429, 500, 502, 503, 504].forEach(s => expect(isRetryableError(httpError(s))).toBe(true));
  });

  it('never retries business failures', () => {
    [400, 401, 403, 404, 409, 422].forEach(s => expect(isRetryableError(httpError(s))).toBe(false));
    expect(isRetryableError(markNonRetryable(new Error('image is too dark')))).toBe(false);
  });
});

describe('withRetry', () => {
  const fast = { baseDelay: 1, maxDelay: 2 };

  it('returns the first successful result without retrying', async () => {
    const task = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(task, fast)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries a network failure up to 3 times, then succeeds', async () => {
    const onRetry = jest.fn();
    const task = jest.fn().mockRejectedValueOnce(netError()).mockRejectedValueOnce(netError()).mockResolvedValue('ok');
    await expect(withRetry(task, { ...fast, onRetry })).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(c => c[0])).toEqual([1, 2]);
  });

  it('gives up after 1 attempt + 3 retries and rethrows the last error', async () => {
    const task = jest.fn().mockRejectedValue(netError());
    await expect(withRetry(task, fast)).rejects.toThrow('Network request failed');
    expect(task).toHaveBeenCalledTimes(4);
  });

  it('fails fast on a non retryable error', async () => {
    const task = jest.fn().mockRejectedValue(httpError(409));
    await expect(withRetry(task, fast)).rejects.toThrow('http 409');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('stops retrying once the upload is cancelled', async () => {
    let cancelled = false;
    const task = jest.fn().mockImplementation(() => {
      cancelled = true;
      return Promise.reject(netError());
    });
    await expect(withRetry(task, { ...fast, isCancelled: () => cancelled })).rejects.toThrow();
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('offline handling', () => {
  const fast = { baseDelay: 1, maxDelay: 2, probeInterval: 5, offlineWaitTimeout: 500 };

  it('does not burn the retry budget while the device is offline', async () => {
    online = false;
    const task = jest.fn().mockRejectedValue(netError());
    await expect(withRetry(task, fast)).rejects.toThrow('Network request failed');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries as soon as the connection comes back', async () => {
    online = false;
    const onWaitingForConnection = jest.fn();
    const task = jest.fn().mockImplementationOnce(() => Promise.reject(netError())).mockResolvedValue('ok');
    const pending = withRetry(task, { ...fast, offlineWaitTimeout: 5000, onWaitingForConnection });
    await new Promise(resolve => setTimeout(resolve, 30));
    online = true;
    await expect(pending).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
    expect(onWaitingForConnection.mock.calls.map(c => c[0])).toEqual([true, false]);
  });

  it('still uses the normal backoff when the device is online', async () => {
    const task = jest.fn().mockRejectedValueOnce(netError()).mockResolvedValue('ok');
    await expect(withRetry(task, fast)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('stops waiting for the connection once the upload is cancelled', async () => {
    online = false;
    let cancelled = false;
    const task = jest.fn().mockRejectedValue(netError());
    const pending = withRetry(task, { ...fast, offlineWaitTimeout: 5000, isCancelled: () => cancelled });
    await new Promise(resolve => setTimeout(resolve, 20));
    cancelled = true;
    await expect(pending).rejects.toThrow();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('separates transport failures from http failures', () => {
    expect(isNetworkLevelError(netError())).toBe(true);
    expect(isNetworkLevelError(httpError(503))).toBe(false);
  });
});

describe('assertUploadResponseOk', () => {
  it('throws on a non 2xx S3 response instead of reporting success', () => {
    expect(() => assertUploadResponseOk({ info: () => ({ status: 403 }) })).toThrow('S3 upload failed with status 403');
  });

  it('passes a 200 through', () => {
    const response = { info: () => ({ status: 200 }) };
    expect(assertUploadResponseOk(response)).toBe(response);
  });

  it('flags a stale pre-signed url', () => {
    expect(isExpiredSignatureError(httpError(403))).toBe(true);
    expect(isExpiredSignatureError(httpError(500))).toBe(false);
  });
});
