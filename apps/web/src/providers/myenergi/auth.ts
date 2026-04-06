/**
 * HTTP Digest Authentication (RFC 2617) using Node.js built-in crypto.
 * Supports both qop=auth and legacy no-qop challenges.
 */

import { createHash, randomBytes } from 'crypto';

function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

type DigestChallenge = {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
};

function parseWwwAuthenticate(header: string): DigestChallenge {
  const params: Record<string, string> = {};
  const re = /(\w+)="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(header)) !== null) {
    params[match[1]] = match[2];
  }
  if (!params['realm'] || !params['nonce']) {
    throw new Error('[myenergi-auth] Invalid WWW-Authenticate header: missing realm or nonce');
  }
  return {
    realm: params['realm'],
    nonce: params['nonce'],
    qop: params['qop'],
    opaque: params['opaque'],
    algorithm: params['algorithm'],
  };
}

function buildAuthorizationHeader(
  method: string,
  uri: string,
  username: string,
  password: string,
  challenge: DigestChallenge,
): string {
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  let authHeader: string;

  const useQopAuth = challenge.qop?.split(',').map((s) => s.trim()).includes('auth') ?? false;

  if (useQopAuth) {
    const nc = '00000001';
    const cnonce = randomBytes(8).toString('hex');
    response = md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:auth:${ha2}`);
    authHeader =
      `Digest username="${username}", realm="${challenge.realm}", ` +
      `nonce="${challenge.nonce}", uri="${uri}", qop=auth, nc=${nc}, ` +
      `cnonce="${cnonce}", response="${response}"` +
      (challenge.opaque ? `, opaque="${challenge.opaque}"` : '');
  } else {
    // Legacy no-qop style
    response = md5(`${ha1}:${challenge.nonce}:${ha2}`);
    authHeader =
      `Digest username="${username}", realm="${challenge.realm}", ` +
      `nonce="${challenge.nonce}", uri="${uri}", response="${response}"` +
      (challenge.opaque ? `, opaque="${challenge.opaque}"` : '');
  }

  return authHeader;
}

/**
 * Perform a single GET request using HTTP Digest Auth.
 * Issues the initial unauthenticated request, reads the 401 challenge,
 * then re-issues the request with the computed Authorization header.
 */
export async function digestGet(
  url: string,
  username: string,
  password: string,
): Promise<Response> {
  // Step 1: unauthenticated request to obtain the challenge
  const challengeResponse = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (challengeResponse.status !== 401) {
    // Some servers (or test stubs) skip the challenge and respond directly
    return challengeResponse;
  }

  const wwwAuth = challengeResponse.headers.get('WWW-Authenticate');
  if (!wwwAuth || !wwwAuth.toLowerCase().startsWith('digest')) {
    throw new Error(`[myenergi-auth] Unexpected auth scheme: ${wwwAuth}`);
  }

  const challenge = parseWwwAuthenticate(wwwAuth);
  const parsedUrl = new URL(url);
  const uri = parsedUrl.pathname + (parsedUrl.search ?? '');
  const authHeader = buildAuthorizationHeader('GET', uri, username, password, challenge);

  // Step 2: authenticated request
  return fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: authHeader,
    },
    cache: 'no-store',
  });
}
