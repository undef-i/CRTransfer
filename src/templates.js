export const t = {
  top: {
    name: '停靠车次最多的车站',
    code: `const d = await qry('rdat');
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
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => \`\${context.label}: \${context.parsed.y} 车次\`
        }
      }
    },
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
    code: `const d = await qry('rdat');
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
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return \`\${label}: \${value} (\${percentage}%)\`;
          }
        }
      }
    }
  }
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
  type: 'bar',
  data: {
    labels: Array.from({length: 24}, (_, i) => \`\${i}:00-\${i}:59\`),
    datasets: [{
      label: '发车数量',
      data: h,
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => \`\${context.label}: \${context.parsed.y} 车次\`
        }
      }
    },
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
  type: 'bar',
  data: {
    labels: data.map(item => item.route),
    datasets: [{
      label: '运行里程',
      data: data.map(item => item.km),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = data[context.dataIndex];
            return \`\${item.tn}: \${item.route} - \${context.parsed.x} 公里\`;
          }
        }
      }
    }
  }
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
  type: 'bar',
  data: {
    labels: data.map(item => item.route),
    datasets: [{
      label: '平均速度',
      data: data.map(item => item.speed),
      borderWidth: 1
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const item = data[context.dataIndex];
            return \`\${item.tn}: \${item.route} - \${context.parsed.x} km/h\`;
          }
        }
      }
    }
  }
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
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => \`\${context.label}: 可直达 \${context.parsed.x} 个站\`
        }
      }
    }
  }
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