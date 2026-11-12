const ENDPOINT = "https://api.buffer.com";

export class BufferApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "BufferApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createBufferClient({ token, fetchImpl = fetch, endpoint = ENDPOINT } = {}) {
  if (!token) throw new BufferApiError("BUFFER_API_KEY is required", { code: "missing_credentials" });
  return async function graphql(query, variables = {}) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      throw new BufferApiError(`Buffer request failed: ${error.message}`, { code: "network_error" });
    }
    if (response.status === 401 || response.status === 403) {
      throw new BufferApiError(`Buffer rejected the token or required permissions (HTTP ${response.status})`, {
        status: response.status, code: response.status === 403 ? "forbidden" : "unauthorized",
      });
    }
    if (!response.ok) throw new BufferApiError(`Buffer HTTP error ${response.status}`, { status: response.status, code: "http_error" });
    let payload;
    try { payload = await response.json(); }
    catch { throw new BufferApiError("Buffer returned invalid JSON", { code: "invalid_json" }); }
    if (Array.isArray(payload?.errors) && payload.errors.length) {
      const messages = payload.errors.map((item) => item?.message || "Unknown GraphQL error");
      throw new BufferApiError(`Buffer GraphQL error: ${messages.join("; ")}`, { code: "graphql_error", details: payload.errors });
    }
    if (!payload || !Object.hasOwn(payload, "data")) throw new BufferApiError("Buffer response is missing data", { code: "invalid_response" });
    return payload.data;
  };
}

export function assertMutationSuccess(result, field) {
  const payload = result?.[field];
  if (!payload) throw new BufferApiError(`Buffer mutation returned no ${field} result`, { code: "invalid_mutation_response" });
  if (payload.__typename === "MutationError" || payload.message && !payload.post) {
    throw new BufferApiError(`Buffer mutation failed: ${payload.message || "unknown error"}`, { code: "mutation_error", details: payload });
  }
  if (!payload.post?.id) throw new BufferApiError("Buffer mutation did not return a post ID", { code: "invalid_mutation_response", details: payload });
  return payload.post;
}

export { ENDPOINT as BUFFER_ENDPOINT };
