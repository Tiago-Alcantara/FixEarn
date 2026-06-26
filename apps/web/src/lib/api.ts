import type {
  BuildTxResponse,
  SubmitTxDto,
  SubmitTxResponse,
  RegisterWalletDto,
  CreateBillDto,
  SpendableView,
  Bill,
} from '@yield2pay/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`ApiError: ${status}`);
    this.name = 'ApiError';
  }
}

type GetToken = () => Promise<string | null>;

interface ApiMethods {
  registerWallet(body: RegisterWalletDto): Promise<void>;
  buildDeposit(amount: string): Promise<BuildTxResponse>;
  submitDeposit(body: SubmitTxDto): Promise<SubmitTxResponse>;
  buildWithdraw(amount: string): Promise<BuildTxResponse>;
  submitWithdraw(body: SubmitTxDto): Promise<SubmitTxResponse>;
  getDashboard(): Promise<SpendableView>;
  listBills(): Promise<Bill[]>;
  createBill(body: CreateBillDto): Promise<Bill>;
  deleteBill(id: string): Promise<void>;
}

export function createApi(getToken: GetToken): ApiMethods {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  async function request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`;
    const token = await getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const fetchInit: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      fetchInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchInit);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new ApiError(response.status, errorBody);
    }

    return response.json();
  }

  return {
    registerWallet: (body: RegisterWalletDto) =>
      request('/wallet', 'POST', body),

    buildDeposit: (amount: string) =>
      request('/deposit/build', 'POST', { amount }),

    submitDeposit: (body: SubmitTxDto) =>
      request('/deposit/submit', 'POST', body),

    buildWithdraw: (amount: string) =>
      request('/withdraw/build', 'POST', { amount }),

    submitWithdraw: (body: SubmitTxDto) =>
      request('/withdraw/submit', 'POST', body),

    getDashboard: () => request('/dashboard', 'GET'),

    listBills: () => request('/bills', 'GET'),

    createBill: (body: CreateBillDto) => request('/bills', 'POST', body),

    deleteBill: (id: string) => request(`/bills/${id}`, 'DELETE'),
  };
}
