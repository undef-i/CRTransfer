export const t = {
  top: {
    name: '停靠车次最多的车站',
    code: `const d = qry('rdat');
const c = {};
d.forEach(t => t.s.forEach(s => c[s.n] = (c[s.n] || 0) + 1));
const data = Object.entries(c).map(([s, n]) => ({s, n})).sort((a, b) => b.n - a.n).slice(0, 15);

return {
  type: 'bar',
  data: {
    labels: data.map(d => d.s),
    datasets: [{
      label: '停靠车次数量',
      data: data.map(d => d.n),
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
};`
  },

  types: {
    name: '所有车次的类型分布',
    code: `const d = qry('rdat');
const c = {};
const g = n => isNaN(n[0]) ? n[0] : '数字';
d.forEach(t => {
  const y = g(t.tn);
  c[y] = (c[y] || 0) + 1;
});

return {
  type: 'pie',
  data: {
    labels: Object.keys(c),
    datasets: [{
      data: Object.values(c),
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  }
};`
  },

  lines: {
    name: '全天各时段发车数量',
    code: `const d = qry('rdat');
const h = Array(24).fill(0);
d.forEach(t => {
  if(t.s.length > 0) {
    const hour = Math.floor(t.s[0].d / 60) % 24;
    h[hour]++;
  }
});

return {
  type: 'bar',
  data: {
    labels: Array.from({length: 24}, (_, i) => i + ':00-' + i + ':59'),
    datasets: [{
      label: '发车数量',
      data: h,
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    }
  }
};`
  },

  mileage: {
    name: '运行里程最长的车次',
    code: `const d = qry('rdat');
const data = d.filter(t => t.s.length > 1).map(t => {
  const first = t.s[0];
  const last = t.s[t.s.length - 1];
  return {
    tn: t.tn,
    route: first.n + ' → ' + last.n,
    km: last.km
  };
}).sort((a, b) => b.km - a.km).slice(0, 15).reverse();

return {
  type: 'bar',
  data: {
    labels: data.map(item => item.tn + ' ' + item.route),
    datasets: [{
      label: '运行里程（公里）',
      data: data.map(item => item.km),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false
  }
};`
  },

  speed: {
    name: '平均旅行速度最快的车次',
    code: `const d = qry('rdat');
const data = d.filter(t => t.s.length > 1).map(t => {
  const first = t.s[0];
  const last = t.s[t.s.length - 1];
  const duration = last.a - first.d;
  if (duration <= 0) return null;
  const km = last.km - first.km;
  const speed = Math.round(km / (duration / 60));
  return {
    tn: t.tn,
    route: first.n + ' → ' + last.n,
    speed: speed
  };
}).filter(Boolean).sort((a, b) => b.speed - a.speed).slice(0, 15).reverse();

return {
  type: 'bar',
  data: {
    labels: data.map(item => item.tn + ' ' + item.route),
    datasets: [{
      label: '平均速度（km/h）',
      data: data.map(item => item.speed),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false
  }
};`
  },

  hub: {
    name: '可直达其他站点最多的车站',
    code: `const d = qry('rdat');
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
  type: 'bar',
  data: {
    labels: data.map(item => item.station),
    datasets: [{
      label: '可直达站点数',
      data: data.map(item => item.count),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false
  }
};`
  },

  raw: {
    name: '部分原始列车数据',
    code: `const d = qry('rdat');
return d.slice(0, 5);`
  }
};

export const prompt = `你是一个代码生成助手，根据我的需求写一段在铁路时刻表查询页面中执行的JavaScript代码，页面提供函数qry('rdat')返回全部车次数组，qry('scdat')返回同城车站分组对象，qry('rts')返回线路数据对象，车次数组的元素结构为{"tn":车次号字符串（纯数字为普通列车），"s":停站数组}，停站结构为{"id":全网唯一的车站编号整数，"n":站名，"a":到达时刻（自该车次首日0点起算的分钟数，可超过1440表示次日或更晚），"d":出发时刻（规则同a），"km":自始发站起算的累计里程公里数整数，"plat":站台字符串（此字段可缺省）}，示例{"tn":"4081","s":[{"id":1851,"n":"齐齐哈尔","a":885,"d":885,"km":0},{"id":704,"n":"高头","a":894,"d":896,"km":10},{"id":665,"n":"富裕","a":940,"d":946,"km":63}]}。同城车站分组对象结构为{"g":[{"s":[{"n":站名}]}]}，每个g元素是一组同城车站，示例{"g":[{"s":[{"n":"南京"},{"n":"仙林"},{"n":"南京南"}]}]}。线路数据对象结构为{"l":[{"i":线路编号，"n":线路名，"s":[{"n":站名，"t":电报略号，"f":标记（0或-1），"d":自线路起点起算的里程公里数}]}],"r":[{"c":车次号，"e":终点站名，"s":[{"n":站名，"l":该站的线路编号}]}]}，示例{"l":[{"i":1,"n":"阿阿铁路","s":[{"n":"萨特玛","t":"STR","f":-1,"d":0},{"n":"阿瓦提","t":"AWR","f":-1,"d":41}]}],"r":[{"c":"S2101","e":"宁波","s":[{"n":"杭州南","l":217},{"n":"钱清","l":217}]}]}。代码作为函数体执行并以return返回结果，返回值是字符串时页面按HTML格式渲染展示，返回值是数组、对象、数字等纯数据时页面以文本展示，返回值为{"type":"bar或line或pie等Chart.js图表类型","data":{"labels":[],"datasets":[{"label":"系列名","data":[]}]},"options":{"responsive":true,"maintainAspectRatio":false}}形状的图表配置对象时页面绘制图表。示例：需求为列出前5趟车次的车次号和始发站、终到站，代码为const d=qry('rdat');return d.slice(0,5).map(t=>t.tn+' '+t.s[0].n+' → '+t.s[t.s.length-1].n);你的回复内容为一个JavaScript代码块，我的需求是：`;

export const keys = () => Object.keys(t);
export const name = (k) => t[k]?.name || k;
export const load = (k) => t[k]?.code || '';
