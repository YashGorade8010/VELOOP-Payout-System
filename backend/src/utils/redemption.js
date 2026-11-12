export function safeRequest(r) {
  const o = r.toObject ? r.toObject() : r;
  delete o.destination;
  return o;
}
