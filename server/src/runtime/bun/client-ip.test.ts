import { expect, test } from "bun:test";

import { clientIp } from "./client-ip";

const server = { requestIP: () => ({ address: "203.0.113.7" }) };
const request = new Request("http://localhost/", {
  headers: { "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2" }
});

test("uses the socket address and ignores proxy headers by default", () => {
  expect(clientIp(request, server, null)).toBe("203.0.113.7");
});

test("reads only the proxy header that was explicitly trusted", () => {
  expect(clientIp(request, server, "x-real-ip")).toBe("198.51.100.2");
  expect(clientIp(new Request("http://localhost/"), server, "x-real-ip")).toBeNull();
});
