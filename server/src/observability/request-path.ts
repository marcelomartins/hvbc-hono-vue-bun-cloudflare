const UUID_V7_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function sanitizedRequestPath(request: Request): string {
  return new URL(request.url).pathname
    .split("/")
    .map((segment) => (UUID_V7_SEGMENT.test(segment) ? ":uuid" : segment))
    .join("/");
}
