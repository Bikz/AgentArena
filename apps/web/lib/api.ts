export function apiBaseHttp() {
  return process.env.NEXT_PUBLIC_API_HTTP_URL ?? "http://localhost:3001";
}

