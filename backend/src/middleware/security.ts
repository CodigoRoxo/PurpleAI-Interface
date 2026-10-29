import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

export const API_TOKEN_HEADER = 'x-purpleai-token';

export interface SecurityConfig {
  allowedOrigins: string[];
  allowedHosts: string[];
  apiToken: string;
}

function hostnameOf(hostHeader: string): string {
  // Suporta "localhost:3001", "127.0.0.1:3001" e "[::1]:3001"
  if (hostHeader.startsWith('[')) {
    return hostHeader.slice(1, hostHeader.indexOf(']'));
  }
  return hostHeader.split(':')[0];
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Bloqueia requisições vindas de sites de terceiros (CSRF), ataques de DNS rebinding
 * e, quando um token está configurado, qualquer cliente que não o apresente.
 */
export function createSecurityGuard(config: SecurityConfig) {
  const allowedOrigins = new Set(config.allowedOrigins);
  const allowedHosts = new Set(config.allowedHosts.map(h => h.toLowerCase()));

  return (req: Request, res: Response, next: NextFunction): void => {
    if (config.apiToken) {
      const provided = req.header(API_TOKEN_HEADER) || '';
      if (!tokensMatch(provided, config.apiToken)) {
        res.status(401).json({ error: 'Token de API ausente ou inválido' });
        return;
      }
    } else {
      const host = hostnameOf((req.headers.host || '').toLowerCase());
      if (!allowedHosts.has(host)) {
        res.status(403).json({ error: `Host não autorizado: ${host || '(vazio)'}` });
        return;
      }
    }

    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: `Origem não autorizada: ${origin}` });
      return;
    }

    next();
  };
}

export const securityGuard = createSecurityGuard({
  allowedOrigins: env.ALLOWED_ORIGINS,
  allowedHosts: env.ALLOWED_HOSTS,
  apiToken: env.API_TOKEN,
});
