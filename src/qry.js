let w;
let rid = 0;
const req = new Map();

function iw() {
  if (w) return Promise.resolve();
  return new Promise((res, rej) => {
    w = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => {
      const { t, d, requestId } = e.data;
      if (t === "qr" && req.has(requestId)) {
        req.get(requestId)(d);
        req.delete(requestId);
      } else if (t === "err" && req.has(requestId)) {
        req.get(requestId)(null);
        req.delete(requestId);
      }
    };
    w.postMessage({ t: "init_only" });
    setTimeout(() => res(), 100);
  });
}

export async function qry(t, k) {
  await iw();
  return new Promise((res) => {
    const id = ++rid;
    req.set(id, res);
    w.postMessage({ t: "qry", d: { t, k }, requestId: id });
  });
}
