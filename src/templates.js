export const t = {
  top: {
    name: '车次最多',
    code: `// 车次最多的站
const d = await qry('rdat');
const c = {};
d.forEach(t => t.s.forEach(s => c[s.n] = (c[s.n] || 0) + 1));
return Object.entries(c).map(([s, n]) => ({s, n})).sort((a, b) => b.n - a.n).slice(0, 20);`
  },
  
  types: {
    name: '类型最多', 
    code: `// 车次类型最多的站
const d = await qry('rdat');
const c = {};
const g = n => isNaN(n[0]) ? n[0] : 'N';
d.forEach(t => {
  const y = g(t.tn);
  t.s.forEach(s => {
    if(!c[s.n]) c[s.n] = new Set();
    c[s.n].add(y);
  });
});
return Object.entries(c).map(([s, t]) => ({s, n: t.size, t: [...t].sort()})).sort((a, b) => b.n - a.n).slice(0, 10);`
  }
};

export const keys = () => Object.keys(t);
export const name = (k) => t[k]?.name || k;
export const load = (k) => t[k]?.code || '';