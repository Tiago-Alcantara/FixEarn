import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApi, ApiError } from './api';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as any);
}

describe('createApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches bearer token and posts deposit build', async () => {
    const f = mockFetch(200, { xdr: 'X', hash: '0xh' });
    vi.stubGlobal('fetch', f);
    const api = createApi(async () => 'tok123');
    const res = await api.buildDeposit('10750000');
    expect(res).toEqual({ xdr: 'X', hash: '0xh' });
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toMatch(/\/deposit\/build$/);
    expect(init.headers.Authorization).toBe('Bearer tok123');
    expect(JSON.parse(init.body)).toEqual({ amount: '10750000' });
  });

  it('throws ApiError on non-2xx', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { message: 'no' }));
    const api = createApi(async () => null);
    await expect(api.getDashboard()).rejects.toBeInstanceOf(ApiError);
  });
});
