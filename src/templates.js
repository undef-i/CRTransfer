export const t = {
  top: {
    name: '停靠车次最多的车站',
    code: `const d = await qry('rdat');
const c = {};
d.forEach(t => t.s.forEach(s => c[s.n] = (c[s.n] || 0) + 1));
const data = Object.entries(c).map(([s, n]) => ({s, n})).sort((a, b) => b.n - a.n).slice(0, 15);

return {
  tooltip: { 
    trigger: 'axis',
    formatter: '{b}: {c}'
  },
  grid: { top: 10, bottom: 40, left: 50, right: 20 },
  xAxis: { 
    type: 'category', 
    data: data.map(d => d.s),
    axisLabel: { rotate: 45, fontSize: 11 }
  },
  yAxis: { 
    type: 'value',
    axisLabel: { fontSize: 11 }
  },
  series: [{
    type: 'bar',
    data: data.map(d => d.n),
    itemStyle: { 
      borderRadius: [2, 2, 0, 0]
    }
  }]
};`
  },
  
  types: {
    name: '所有车次的类型分布',
    code: `const d = await qry('rdat');
const c = {};
const g = n => isNaN(n[0]) ? n[0] : '数字';
d.forEach(t => {
  const y = g(t.tn);
  c[y] = (c[y] || 0) + 1;
});

return {
  tooltip: { 
    trigger: 'item',
    formatter: '{a}: {c} ({d}%)'
  },
  legend: { 
    orient: 'horizontal', 
    bottom: 0,
    textStyle: { fontSize: 11 }
  },
  series: [{
    type: 'pie',
    radius: ['30%', '60%'],
    center: ['50%', '45%'],
    data: Object.entries(c).map(([name, value]) => ({name, value})),
    label: { fontSize: 11, position: 'outside' }
  }]
};`
  },

  lines: {
    name: '全天各时段发车数量',
    code: `const d = await qry('rdat');
const h = Array(24).fill(0);
d.forEach(t => {
  if(t.s.length > 0) {
    const hour = Math.floor(t.s[0].d / 60) % 24;
    h[hour]++;
  }
});

return {
  tooltip: { 
    trigger: 'axis',
    formatter: '{b}:00-{b}:59: {c} 车次'
  },
  grid: { top: 10, bottom: 30, left: 50, right: 20 },
  xAxis: { 
    type: 'category', 
    data: Array.from({length: 24}, (_, i) => i),
    axisLabel: { fontSize: 11 }
  },
  yAxis: { 
    type: 'value',
    axisLabel: { fontSize: 11 }
  },
  series: [{
    type: 'bar',
    data: h,
    itemStyle: { 
      borderRadius: [2, 2, 0, 0]
    }
  }]
};`
  },

  mileage: {
    name: '运行里程最长的车次',
    code: `const d = await qry('rdat');
const data = d.filter(t => t.s.length > 1).map(t => {
  const first = t.s[0];
  const last = t.s[t.s.length - 1];
  return {
    tn: t.tn,
    route: \`\${first.n} → \${last.n}\`,
    km: last.km
  };
}).sort((a, b) => b.km - a.km).slice(0, 15).reverse();

return {
  tooltip: { 
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (p) => \`\${p[0].data.tn}<br/>\${p[0].name}<br/>\${p[0].value} 公里\`
  },
  grid: { top: 0, bottom: 0, left: 120, right: 40 },
  xAxis: { type: 'value' },
  yAxis: { 
    type: 'category', 
    data: data.map(item => item.route),
    axisLabel: { fontSize: 11 }
  },
  series: [{
    type: 'bar',
    data: data.map(item => ({...item, value: item.km})),
 
    label: { show: true, position: 'right', formatter: '{c}km', fontSize: 10 }
  }]
};`
  },
  
  speed: {
    name: '平均旅行速度最快的车次',
    code: `const d = await qry('rdat');
const data = d.filter(t => t.s.length > 1).map(t => {
  const first = t.s[0];
  const last = t.s[t.s.length - 1];
  const duration = last.a - first.d;
  if (duration <= 0) return null;
  const km = last.km - first.km;
  const speed = Math.round(km / (duration / 60));
  return {
    tn: t.tn,
    route: \`\${first.n} → \${last.n}\`,
    speed: speed
  };
}).filter(Boolean).sort((a, b) => b.speed - a.speed).slice(0, 15).reverse();

return {
  tooltip: { 
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (p) => \`\${p[0].data.tn}<br/>\${p[0].name}<br/>\${p[0].value} km/h\`
  },
  grid: { top: 0, bottom: 0, left: 120, right: 60 },
  xAxis: { type: 'value' },
  yAxis: { 
    type: 'category', 
    data: data.map(item => item.route),
    axisLabel: { fontSize: 11 }
  },
  series: [{
    type: 'bar',
    data: data.map(item => ({...item, value: item.speed})),
 
    label: { show: true, position: 'right', formatter: '{c}km/h', fontSize: 10 }
  }]
};`
  },

  hub: {
    name: '可直达其他站点最多的车站',
    code: `const d = await qry('rdat');
const reach = {};
d.forEach(t => {
  for (let i = 0; i < t.s.length; i++) {
    const startNode = t.s[i].n;
    if (!reach[startNode]) reach[startNode] = new Set();
    for (let j = i + 1; j < t.s.length; j++) {
      reach[startNode].add(t.s[j].n);
    }
  }
});
const data = Object.entries(reach)
  .map(([station, destinations]) => ({ station, count: destinations.size }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 15).reverse();

return {
  tooltip: { 
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: '{b}: 可直达 {c} 个站'
  },
  grid: { top: 0, bottom: 0, left: 60, right: 50 },
  xAxis: { type: 'value' },
  yAxis: { 
    type: 'category', 
    data: data.map(item => item.station),
    axisLabel: { fontSize: 11 }
  },
  series: [{
    type: 'bar',
    data: data.map(item => item.count),
 
    label: { show: true, position: 'right', fontSize: 10 }
  }]
};`
  },
  
  raw: {
    name: '部分原始列车数据',
    code: `const d = await qry('rdat');
return d.slice(0, 5);`
  }
};

export const keys = () => Object.keys(t);
export const name = (k) => t[k]?.name || k;
export const load = (k) => t[k]?.code || '';