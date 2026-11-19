let dataResolve = null;
const dataReady = new Promise((resolve) => {
  dataResolve = resolve;
});

self.onmessage = async (e) => {
  if (!e.data) return;
  if (e.data.t === "data") {
    dataResolve(e.data.d);
    return;
  }
  if (e.data.t !== "run") return;
  try {
    const { trains, scdat, rts } = await dataReady;
    self.qry = (type) =>
      type === "rdat"
        ? trains
        : type === "scdat"
          ? scdat
          : type === "rts"
            ? rts
            : [];
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const func = new AsyncFunction(e.data.code);
    const result = await func();
    try {
      self.postMessage({ t: "result", d: result === undefined ? null : result });
    } catch {
      self.postMessage({
        t: "error",
        d: "查询结果包含无法传回页面的内容（例如函数），请只返回纯数据",
        stack: "",
      });
    }
  } catch (err) {
    self.postMessage({
      t: "error",
      d: String((err && err.message) || err),
      stack: String((err && err.stack) || ""),
    });
  }
};
