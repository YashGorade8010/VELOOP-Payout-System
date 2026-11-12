const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000';

export async function api(path, token, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (cause) {
    const error = new Error('Unable to connect to VELOOP Rewards. Check your connection and try again.');
    error.code = 'NETWORK_ERROR';
    error.cause = cause;
    throw error;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || 'The request could not be completed.');
    error.code = result.error?.code;
    error.status = response.status;
    throw error;
  }
  return result;
}
