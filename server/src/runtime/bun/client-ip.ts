interface SocketInfo {
  requestIP(request: Request): { address: string } | null;
}

/**
 * The socket address unless a proxy header is trusted explicitly. Clients can send
 * any header, so one is only correct when the proxy overwrites it on every request;
 * x-forwarded-for is never read by default for that reason.
 */
export function clientIp(request: Request, server: SocketInfo, trustedProxyIpHeader: string | null): string | null {
  if (trustedProxyIpHeader !== null) return request.headers.get(trustedProxyIpHeader);
  return server.requestIP(request)?.address ?? null;
}
