export function fail(status, message, code = "REQUEST_FAILED") {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}
