import type {
  ApiErrorResponse,
  ChronicleDetail,
  ChroniclePayload,
  ChronicleSummary,
  ContactPayload,
  ContactResponse,
  SessionPayload,
} from '../types';

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as T | ApiErrorResponse)
    : null;

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? payload.error
      : `Request failed with status ${response.status}`;
    const fieldErrors = payload && typeof payload === 'object' && 'fieldErrors' in payload
      ? payload.fieldErrors || {}
      : {};
    throw new ApiError(message, response.status, fieldErrors);
  }

  return (payload || {}) as T;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  csrfToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers || {});
  const hasBody = init.body !== undefined && init.body !== null;

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (csrfToken) {
    headers.set('X-CSRFToken', csrfToken);
  }

  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers,
  });

  return parseResponse<T>(response);
}

export const api = {
  fetchSession: () => request<SessionPayload>('/api/session'),
  login: (email: string, password: string, csrfToken: string) =>
    request<SessionPayload>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      csrfToken,
    ),
  register: (name: string, email: string, password: string, csrfToken: string) =>
    request<SessionPayload>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      },
      csrfToken,
    ),
  logout: (csrfToken: string) => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, csrfToken),
  fetchChronicles: () => request<{ chronicles: ChronicleSummary[] }>('/api/chronicles'),
  fetchChronicle: (id: string) => request<{ chronicle: ChronicleDetail }>(`/api/chronicles/${id}`),
  sendContact: (payload: ContactPayload, csrfToken: string) =>
    request<ContactResponse>(
      '/api/contact',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      csrfToken,
    ),
  createComment: (id: string, commentText: string, csrfToken: string) =>
    request<{ commentAdded: boolean }>(
      `/api/chronicles/${id}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ commentText }),
      },
      csrfToken,
    ),
  createFragment: (payload: ChroniclePayload, csrfToken: string) =>
    request<{ chronicle: ChronicleDetail }>(
      '/api/fragments',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      csrfToken,
    ),
  fetchFragment: (id: string) => request<{ chronicle: ChronicleDetail }>(`/api/fragments/${id}`),
  updateFragment: (id: string, payload: ChroniclePayload, csrfToken: string) =>
    request<{ chronicle: ChronicleDetail }>(
      `/api/fragments/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      csrfToken,
    ),
  deleteFragment: (id: string, csrfToken: string) =>
    request<{ deleted: boolean }>(`/api/fragments/${id}`, { method: 'DELETE' }, csrfToken),
};
