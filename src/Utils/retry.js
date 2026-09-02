import {
  API_BASE_URL,
  CONNECTION_PROBE_INTERVAL_MS,
  CONNECTION_PROBE_TIMEOUT_MS,
  MAX_UPLOAD_RETRIES,
  OFFLINE_WAIT_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from '../Constants';

const RETRYABLE_ERROR_CODES = ['ECONNABORTED', 'ECONNRESET', 'ENETUNREACH', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ERR_NETWORK'];

const RETRYABLE_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504];

const NETWORK_ERROR_MESSAGE = /(network|timeout|timed out|socket|connection|unreachable|offline|host|stream closed|software caused|broken pipe|aborted)/i;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const markNonRetryable = error => {
  if (error) {
    error.noRetry = true;
  }
  return error;
};

export const isRetryableError = error => {
  if (!error || error.noRetry === true) {
    return false;
  }

  const status = error?.response?.status ?? error?.status ?? null;
  if (status !== null && status !== undefined) {
    return RETRYABLE_STATUS_CODES.includes(status);
  }

  if (RETRYABLE_ERROR_CODES.includes(error?.code)) {
    return true;
  }

  if (error?.isAxiosError === true) {
    return true;
  }

  return NETWORK_ERROR_MESSAGE.test(String(error?.message || ''));
};

export const isNetworkLevelError = error => {
  const status = error?.response?.status ?? error?.status ?? null;

  if (status !== null && status !== undefined) {
    return false;
  }

  return isRetryableError(error);
};

export const probeConnection = async (timeout = CONNECTION_PROBE_TIMEOUT_MS) => {
  if (typeof fetch !== 'function') {
    return true;
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

  try {
    await fetch(API_BASE_URL, { method: 'HEAD', signal: controller?.signal });
    return true;
  } catch (error) {
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const waitForConnection = async (options = {}) => {
  const { isCancelled = null, deadline = 0, interval = CONNECTION_PROBE_INTERVAL_MS, probeTimeout = CONNECTION_PROBE_TIMEOUT_MS } = options;

  while (Date.now() < deadline) {
    if (isCancelled?.() === true) {
      return false;
    }

    await sleep(interval);

    if (isCancelled?.() === true) {
      return false;
    }

    if (await probeConnection(probeTimeout)) {
      return true;
    }
  }

  return false;
};

export const withRetry = async (task, options = {}) => {
  const {
    retries = MAX_UPLOAD_RETRIES,
    baseDelay = RETRY_BASE_DELAY_MS,
    factor = 2,
    maxDelay = RETRY_MAX_DELAY_MS,
    shouldRetry = isRetryableError,
    onRetry = null,
    onWaitingForConnection = null,
    isCancelled = null,
    offlineWaitTimeout = OFFLINE_WAIT_TIMEOUT_MS,
    probeInterval = CONNECTION_PROBE_INTERVAL_MS,
    probeTimeout = CONNECTION_PROBE_TIMEOUT_MS,
    label = 'request',
  } = options;

  let attempt = 0;
  let offlineDeadline = 0;

  while (true) {
    try {
      return await task(attempt);
    } catch (error) {
      if (!shouldRetry(error) || isCancelled?.() === true) {
        throw error;
      }

      if (isNetworkLevelError(error) && !(await probeConnection(probeTimeout))) {
        if (isCancelled?.() === true) {
          throw error;
        }

        if (offlineDeadline === 0) {
          offlineDeadline = Date.now() + offlineWaitTimeout;
        }

        console.log(`[retry] ${label} is offline, waiting for the connection to come back`);
        onWaitingForConnection?.(true);
        const isBackOnline = await waitForConnection({ isCancelled, deadline: offlineDeadline, interval: probeInterval, probeTimeout });
        onWaitingForConnection?.(false);

        if (!isBackOnline || isCancelled?.() === true) {
          throw error;
        }

        console.log(`[retry] ${label} is back online, retrying now`);
        continue;
      }

      if (attempt >= retries) {
        throw error;
      }

      attempt += 1;
      const delay = Math.min(maxDelay, baseDelay * Math.pow(factor, attempt - 1)) + Math.round(Math.random() * 250);
      console.log(`[retry] ${label} failed (${error?.message}), attempt ${attempt} of ${retries} in ${delay}ms`);
      onRetry?.(attempt, retries, error);

      await sleep(delay);

      if (isCancelled?.() === true) {
        throw error;
      }
    }
  }
};

export const assertUploadResponseOk = response => {
  const status = response?.info?.()?.status;

  if (typeof status === 'number' && (status < 200 || status >= 300)) {
    const error = new Error(`S3 upload failed with status ${status}`);
    error.response = { status, data: response?.data };
    error.status = status;
    throw error;
  }

  return response;
};

export const isExpiredSignatureError = error => {
  const status = error?.response?.status ?? error?.status ?? null;
  return status === 403 || status === 400;
};
