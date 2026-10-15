export function isAntiInspectActive({
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
  nodeEnv = process.env.NODE_ENV,
  envOverride = process.env.NEXT_PUBLIC_ANTI_INSPECT,
} = {}) {
  const params = new URLSearchParams(search);
  const param = params.get("anti_inspect");
  if (param === "false" || param === "0") return false;
  if (param === "true" || param === "1") return true;

  if (envOverride === "false" || envOverride === "0") return false;
  if (envOverride === "true" || envOverride === "1") return true;

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local");

  return nodeEnv === "production" && !isLocal;
}
