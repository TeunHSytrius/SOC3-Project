import { getAuthErrorMessage } from '../features/auth/authErrors';

export const sessionKey = 'soc3.activeUser';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public traceId?: string,
  ) {
    super(
      message +
        (status ? ' (HTTP ' + status + ')' : '') +
        (traceId ? ' · Foutreferentie: ' + traceId : ''),
    );
  }
}

interface RequestContext {
  workspaceId: string;
  scopeId?: string;
}

async function request(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch {
    throw new ApiError('Geen verbinding met de SOC-server. Controleer Docker of je netwerk.', 0);
  }
}

function fallbackMessage(status: number): string {
  switch (status) {
    case 401:
      return getAuthErrorMessage('sessionExpired');
    case 403:
      return 'Je hebt geen toegang tot dit onderdeel.';
    case 429:
      return getAuthErrorMessage('temporarilyBlocked');
    default:
      return 'Verzoek mislukt.';
  }
}

function throwResponseError(response: Response, data: any): never {
  const fields =
    data?.errors && typeof data.errors === 'object'
      ? Object.values(data.errors).flat().join(' ')
      : '';
  const message =
    data?.message || fields || data?.detail || data?.title || fallbackMessage(response.status);
  throw new ApiError(
    message,
    response.status,
    response.headers.get('X-Trace-Id') || data?.traceId || undefined,
  );
}

async function getCsrfToken(): Promise<string> {
  const response = await request('/api/v1/auth/csrf', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throwResponseError(response, await response.json().catch(() => null));
  return (await response.json()).token;
}

function resolveRoute(path: string, body?: Record<string, unknown>) {
  let method = body === undefined ? 'GET' : 'POST';
  if (body !== undefined && /^(users|organizations)\/[^/]+$/.test(path)) method = 'PATCH';

  // Map the UI actions to the routes defined in the technical design.
  path = path.replace(/^(alerts\/[^/]+)\/case$/, '$1/promote');
  if (/^cases\/[^/]+\/(status|owner|visibility)$/.test(path)) {
    path = path.replace(/\/(status|owner|visibility)$/, '');
    method = 'PATCH';
  }
  if (/^cases\/[^/]+\/entry$/.test(path)) {
    path = path.replace(/\/entry$/, body?.kind === 'Observable' ? '/observables' : '/events');
  }
  return { path, method };
}

export async function api<T = any>(
  path: string,
  body?: Record<string, unknown>,
  context?: RequestContext,
): Promise<T> {
  const route = resolveRoute(path, body);
  const headers: Record<string, string> = {};

  // The cookie contains the authentication secret; the tab stores only the user ID.
  const activeUser = sessionStorage.getItem(sessionKey);
  if (activeUser && route.path !== 'auth/login' && route.path !== 'auth/2fa')
    headers['X-SOC-User'] = activeUser;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-TOKEN'] = await getCsrfToken();
  }
  if (context?.workspaceId) headers['X-Workspace-Id'] = context.workspaceId;
  if (context?.scopeId) headers['X-Scope-Id'] = context.scopeId;

  const payload = body
    ? Object.fromEntries(Object.entries(body).filter(([, value]) => value !== ''))
    : undefined;
  const response = await request('/api/v1/' + route.path, {
    method: route.method,
    headers,
    credentials: 'same-origin',
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throwResponseError(response, data);
  if (data === null)
    throw new ApiError(
      'De server gaf geen geldig JSON-antwoord.',
      response.status,
      response.headers.get('X-Trace-Id') || undefined,
    );
  return data as T;
}
