const DATA = window.DASHBOARD_PAYLOAD.DATA;
const STRUCTURE_DATA = window.DASHBOARD_PAYLOAD.STRUCTURE_DATA;
const EFFICIENCY_ANALYSIS_DATA = window.DASHBOARD_PAYLOAD.EFFICIENCY_ANALYSIS_DATA;
const MONTH_LABELS = window.DASHBOARD_PAYLOAD.MONTH_LABELS;
const WEEK_LABELS = window.DASHBOARD_PAYLOAD.WEEK_LABELS;
const ROI_DATA = window.DASHBOARD_PAYLOAD.ROI_DATA;
const ROI_COLORS = ['#007A8C','#0091A5','#00A3B8','#047857','#0f766e'];
const METRICS = [
  {key: 'total_output', label: '总产出', unit: ''},
  {key: 'avg_daily_output', label: '人均日均产出', unit: ''},
  {key: 'saturation', label: '饱和度 ', unit: '人均工时/7小时'},
  {key: 'avg_daily_workload', label: '人均日均工时', unit: 'h'},
  {key: 'single_time', label: '单素材耗时', unit: 'min'}
];
const OUTPUT_METRICS = [
  {key: 'total_output', label: '总产出', unit: ''},
  {key: 'avg_daily_output', label: '人均日均产出', unit: ''}
];
const EFFICIENCY_METRICS = [
  {key: 'saturation', label: '饱和度 ', unit: '人均工时/7小时'},
  {key: 'single_time', label: '单素材耗时', unit: 'min'}
];
const LABOR_COST_MODULES = ['图片', '混剪'];
const LABOR_COST_UNIT = {'图片': '元/张', '混剪': '元/条'};
const LABOR_COST_METRIC = {key: 'single_labor_cost', label: '单素材人力成本', unit: '元'};
const SCRIPT_MODULE = '内容团队-编剧';
const NARROW_OUTPUT_BAR_MODULES = ['内容团队-编剧', '内容团队-导演', '内容团队-摄像', '内容团队-剪辑'];
const SCRIPT_OUTPUT_MODES = {
  write: {label: '写脚本数', prefix: ''},
  handoff: {label: '对接脚本数', prefix: 'handoff_'}
};
const COLORS = [
  '#4338ca','#1d4ed8','#0f766e','#b45309','#b91c1c',
  '#047857','#be185d','#6d28d9','#c2410c','#0f766e'
];
const MODULE_ICONS = ['🎨','🎞️','📝','🎬','📷','✂️'];
const MODULE_BG = [
  'linear-gradient(135deg,#007A8C,#0091A5)',
  'linear-gradient(135deg,#00A3B8,#0CB4C8)',
  'linear-gradient(135deg,#0091A5,#00A3B8)',
  'linear-gradient(135deg,#047857,#059669)',
  'linear-gradient(135deg,#006878,#007A8C)',
  'linear-gradient(135deg,#00B8CC,#22D3EE)'
];

Chart.register(ChartDataLabels);

const TOTAL_COLOR = '#007A8C';
// 各部门图表独立颜色（不引用COLORS数组），青蓝绿色系
const DEPT_COLORS = ['#108899','#108899','#108899','#108899','#108899','#006878','#059669','#0284c7','#0e7490','#065f46'];

let charts = {};

function destroyCharts(moduleName, view) {
  const prefix = moduleName + '_' + view + '_';
  Object.keys(charts).forEach(k => {
    if (k.startsWith(prefix)) { charts[k].destroy(); delete charts[k]; }
  });
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+alpha+')';
}

function fmtVal(val, metricKey) {
  if (val === 0 || val === undefined || val === null) return '-';
  if (metricKey === 'total_output' || metricKey === 'handoff_total_output') return val % 1 === 0 ? val.toString() : val.toFixed(1);
  if (metricKey === 'avg_daily_output' || metricKey === 'handoff_avg_daily_output') return Math.round(val).toString();
  if (metricKey === 'saturation') return Math.round(val * 100) + '%';
  if (metricKey === 'avg_daily_workload') return val.toFixed(1);
  if (metricKey === 'single_time') return val.toFixed(1);
  if (metricKey === 'single_labor_cost') return val.toFixed(2);
  return val;
}

function buildChartCardHeader(title, titleExtra, moduleName, deptName, analysisType) {
  const buttonHtml = analysisType === 'output'
    ? '<button class="chart-drill-btn" type="button" onclick="openStructureAnalysis(\'' + moduleName + '\',\'' + deptName + '\')">分析</button>'
    : analysisType === 'efficiency'
      ? '<button class="chart-drill-btn" type="button" onclick="openEfficiencyAnalysis(\'' + moduleName + '\',\'' + deptName + '\')">分析</button>'
      : '';
  return '<div class="chart-card-head">' +
    '<div class="chart-card-title">' + title + (titleExtra || '') + '</div>' +
    buttonHtml +
  '</div>';
}

function getPeriodText(view) {
  return view === 'monthly' ? '月度' : '周度';
}

function getLatestPeriodText(view) {
  return view === 'monthly' ? '最新月' : '最新周';
}

function getScriptOutputMode() {
  return appState.scriptOutputMode || 'write';
}

function getOutputMetricKey(moduleName, metricKey) {
  if (moduleName === SCRIPT_MODULE && getScriptOutputMode() === 'handoff' && (metricKey === 'total_output' || metricKey === 'avg_daily_output')) {
    return 'handoff_' + metricKey;
  }
  return metricKey;
}

function isAvgDailyOutputMetric(metricKey) {
  return metricKey === 'avg_daily_output' || metricKey === 'handoff_avg_daily_output';
}

function getStructureModuleKey(moduleName) {
  return moduleName === SCRIPT_MODULE && getScriptOutputMode() === 'handoff'
    ? moduleName + '__handoff'
    : moduleName;
}

function formatSingleTimeText(value) {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(1) + ' min';
}

function formatOutputText(value) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  return (num % 1 === 0 ? num.toFixed(0) : num.toFixed(1));
}

function calcChange(vals) {
  if(vals.length<2) return null;
  const va = vals[vals.length-2], vb = vals[vals.length-1];
  if(va===0||vb===0||va===undefined||vb===undefined||va===null||vb===null) return null;
  const pct = ((vb-va)/va*100).toFixed(1);
  return {pct:parseFloat(pct), dir: vb>va?'up':'down'};
}

function trendHTML(ch) {
  if(!ch) return '';
  return '<span class="summary-dept-trend '+(ch.dir==='up'?'up':'down')+'">'+
    (ch.dir==='up'?'&#9650;':'&#9660;')+'</span>';
}

function buildSummaryHTML(m, data, labels, isEfficiency, deptNames, moduleName) {
  const totalVals = labels.map(l => data.total_metrics[l] ? data.total_metrics[l][m.key] : 0);
  const totalCh = calcChange(totalVals);

  let html =
    '<div class="summary-metric-name">' + m.label + (m.unit ? ' <span class="summary-unit">' + m.unit + '</span>' : '') + '</div>' +
    '<div class="summary-latest num' + (isEfficiency ? ' efficiency-color' : '') + '">' + (['内容团队-编剧','内容团队-摄像','内容团队-剪辑'].indexOf(moduleName) >= 0 && m.key === 'avg_daily_output' ? totalVals[totalVals.length - 1].toFixed(1) : fmtVal(totalVals[totalVals.length - 1], m.key)) + '</div>';

  if(totalCh) {
    html += '<div class="summary-trend ' + (totalCh.dir === 'up' ? 'up' : 'down') + '">' +
      (totalCh.dir === 'up' ? '&#9650;' : '&#9660;') + ' ' + Math.abs(totalCh.pct) + '% 环比</div>';
  }

  html += '<div class="summary-depts">';
  deptNames.forEach((d, i) => {
    const vals = labels.map(l => data.dept_metrics[d][l] ? data.dept_metrics[d][l][m.key] : 0);
    const ch = calcChange(vals);
    html += '<div class="summary-dept-row">' +
      '<span class="summary-dept-name"><span class="summary-dept-dot" style="background:' + DEPT_COLORS[i % DEPT_COLORS.length] + '"></span>' +
      '<span class="summary-dept-name-text">' + d + '</span></span>' +
      '<span class="summary-dept-right num">' +
      (['内容团队-编剧','内容团队-摄像','内容团队-剪辑'].indexOf(moduleName) >= 0 && m.key === 'avg_daily_output' ? vals[vals.length - 1].toFixed(1) : fmtVal(vals[vals.length - 1], m.key)) +
      trendHTML(ch) +
      '</span></div>';
  });
  html += '</div>';
  return html;
}

// ===== 创建折线图的公共配置 =====
function createLineChart(canvasId, ctx, item, m, labels, yMax, avgLine, hasTotalChart, moduleName) {
  const vals = labels.map(l => {const v = item.metrics[l]; return v && v[m.key] !== undefined ? v[m.key] : 0;});

  const gradient = ctx.createLinearGradient(0,0,0,160);
  gradient.addColorStop(0, hexToRgba(item.color, item.isTotal ? 0.30 : 0.25));
  gradient.addColorStop(1, hexToRgba(item.color, 0.03));

  const datasets = [{
    data: vals,
    borderColor: item.color,
    borderWidth: item.isTotal ? 2.5 : 2,
    pointRadius: 3, pointHoverRadius: 5,
    pointBackgroundColor: '#fff',
    pointBorderColor: item.color,
    pointBorderWidth: 2,
    fill: true,
    backgroundColor: gradient,
    tension: 0.4,
    shadowColor: hexToRgba(item.color, 0.35),
    shadowBlur: 8,
    shadowOffsetX: 0,
    shadowOffsetY: 3,
  }];

  // 饱和度图：>=100% 圆点绿色，<100% 圆点红色
  if(m.key === 'saturation') {
    const segBorders = vals.map(v => v >= 1.0 ? '#10b981' : '#ef4444');
    datasets[0].segment = {
      borderColor: function(ctx2) {
        const idx = ctx2.p0DataIndex;
        return segBorders[idx] || item.color;
      }
    };
    datasets[0].pointBackgroundColor = vals.map(v => v >= 1.0 ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)');
    datasets[0].pointBorderColor = vals.map(v => v >= 1.0 ? '#10b981' : '#ef4444');
    datasets[0].pointRadius = 3;
    datasets[0].pointHoverRadius = 5;
    datasets[0].pointBorderWidth = 2;

    datasets.push({
      data: labels.map(()=>1.0),
      borderColor: 'rgba(156,163,175,0.5)', borderWidth: 1.5, borderDash: [6,4],
      pointRadius: 0, pointHoverRadius: 0, fill: false,
      datalabels: { display: false }
    });

    charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        layout: { padding: { top: 22 } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          datalabels: {
            labels: {
              saturation: {
                anchor: 'end', align: 'top', offset: 2,
                color: item.isTotal ? TOTAL_COLOR : hexToRgba(item.color, 0.85),
                font: { size: 12, weight: item.isTotal ? '700' : '600', family: "Microsoft YaHei" },
                formatter: v => (['内容团队-编剧','内容团队-摄像','内容团队-剪辑'].indexOf(moduleName) >= 0 && isAvgDailyOutputMetric(m.key)) ? v.toFixed(1) : fmtVal(v, m.key),
                backgroundColor: 'rgba(255,255,255,0.72)',
                borderRadius: 4, padding: { top: 2, bottom: 1, left: 4, right: 4 },
              },
              workload: {
                anchor: 'start', align: 'bottom', offset: 3,
                color: 'rgba(38,38,38,0.8)',
                font: { size: 11, weight: '500', family: "Microsoft YaHei" },
                formatter: function(value, ctx2) {
                  const labelIdx = ctx2.dataIndex;
                  const lbl = labels[labelIdx];
                  const wkData = item.metrics[lbl];
                  const wl = wkData && wkData['avg_daily_workload'] !== undefined ? wkData['avg_daily_workload'] : null;
                  return wl !== null ? wl.toFixed(1) + 'h' : '';
                },
                backgroundColor: 'rgba(255,255,255,0.55)',
                borderRadius: 3, padding: { top: 1, bottom: 1, left: 3, right: 3 },
              }
            }
          }
        },
        scales: {
          y: { display: false, min: 0, max: yMax },
          x: { ticks: { font: { size: 10, color: '#D9D9D9' } }, grid: { display: false }, border: { display: true, color: '#D9D9D9' } }
        }
      }
    });
    return;
  }

  // 人均日均产出、单素材耗时：添加总体均值虚线
  if(avgLine !== undefined && avgLine !== null) {
    datasets.push({
      data: labels.map(()=>avgLine),
      borderColor: 'rgba(59,59,59,0.6)', borderWidth: 1.5, borderDash: [6,4],
      pointRadius: 0, pointHoverRadius: 0, fill: false,
      datalabels: {
        display: function(ctx2) {
          if(item.isTotal && ctx2.dataIndex === 0) return true;
          if(!hasTotalChart && ctx2.dataIndex === 0) return true;
          return false;
        },
        anchor: 'end', align: 'start', offset: 9,
        color: 'rgba(107,114,128,0.9)',
        font: { size: 11, weight: '500', family: "Microsoft YaHei" },
        formatter: () => (['内容团队-编剧','内容团队-摄像','内容团队-剪辑'].indexOf(moduleName) >= 0 && isAvgDailyOutputMetric(m.key)) ? '    标准： ' + avgLine.toFixed(1) : '    标准： ' + fmtVal(avgLine, m.key),
        backgroundColor: 'rgba(255,255,255,0.55)',
        borderRadius: 3, padding: { top: 1, bottom: 1, left: 3, right: 3 },
      }
    });
  }

  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      layout: { padding: { top: 22 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: {
          anchor: 'end', align: 'top', offset: 2,
          color: item.isTotal ? TOTAL_COLOR : hexToRgba(item.color, 0.85),
          font: { size: 12, weight: item.isTotal ? '700' : '600', family: "Microsoft YaHei" },
        formatter: v => (['内容团队-编剧','内容团队-摄像','内容团队-剪辑'].indexOf(moduleName) >= 0 && isAvgDailyOutputMetric(m.key)) ? v.toFixed(1) : fmtVal(v, m.key),
          backgroundColor: 'rgba(255,255,255,0.68)',
          borderRadius: 4, padding: { top: 2, bottom: 1, left: 4, right: 4 },
        }
      },
      scales: {
        y: { display: false, min: 0, max: yMax },
        x: { ticks: { font: { size: 10, color: '#D9D9D9' } }, grid: { display: false }, border: { display: true, color: '#D9D9D9' } }
      }
    }
  });
}

function renderModule(moduleName, view, moduleIdx) {
  destroyCharts(moduleName, view);
  const data = DATA[view][moduleName];
  const labels = view === 'monthly' ? MONTH_LABELS : WEEK_LABELS;
  const container = document.getElementById('charts_' + moduleName + '_' + view);
  container.innerHTML = '';

  const lineItems = [];
  if (data.show_total !== false) {
    lineItems.push({name: '总计', metrics: data.total_metrics, color: TOTAL_COLOR, isTotal: true});
  }
  data.depts.forEach((dept, di) => {
    lineItems.push({name: dept, metrics: data.dept_metrics[dept],
                     color: DEPT_COLORS[di % DEPT_COLORS.length], isTotal: false});
  });

  const deptNames = data.depts;

  // --- 产出指标区块 ---
  const outputGroup = document.createElement('div');
  outputGroup.className = 'metric-group';
  const scriptOutputToggle = moduleName === SCRIPT_MODULE
    ? '<div class="script-output-toggle" role="group" aria-label="编剧产出口径">' +
        Object.keys(SCRIPT_OUTPUT_MODES).map(mode =>
          '<button class="script-output-toggle-btn' + (getScriptOutputMode() === mode ? ' active' : '') + '" type="button" onclick="switchScriptOutputMode(\'' + mode + '\')">' +
            SCRIPT_OUTPUT_MODES[mode].label +
          '</button>'
        ).join('') +
      '</div>'
    : '';
  outputGroup.innerHTML =
    '<div class="group-header">' +
    '<div class="group-title-wrap">' +
      '<div class="group-icon" style="background:linear-gradient(135deg,' + (MODULE_BG[moduleIdx]||MODULE_BG[0]) + ');color:#fff">&#128200;</div>' +
      '<span class="group-label">产出指标</span>' +
      '<span class="group-desc"> — 总量与人均产出</span>' +
    '</div>' +
    scriptOutputToggle +
    '</div>';
  container.appendChild(outputGroup);

  OUTPUT_METRICS.forEach(m => {
    const metricKey = getOutputMetricKey(moduleName, m.key);
    const renderMetric = Object.assign({}, m, {key: metricKey});
    const row = document.createElement('div');
    row.className = 'metric-row';

    let summary = null;
    if(['内容团队-编剧','内容团队-摄像','内容团队-剪辑'].indexOf(moduleName) < 0) {
      summary = document.createElement('div');
      summary.className = 'metric-summary';
      summary.innerHTML = buildSummaryHTML(m, data, labels, false, deptNames, moduleName);
    }

    const chartsRow = document.createElement('div');
    chartsRow.className = 'charts-row';

    let sharedMax = 0;
    let avgLineVal = null;
    if(m.key === 'avg_daily_output') {
      lineItems.forEach(item => {
        labels.forEach(l => {
          const v = item.metrics[l];
          if(v && v[metricKey] !== undefined) sharedMax = Math.max(sharedMax, v[metricKey]);
        });
      });
      if(data.total_metrics) {
        const totalVals = labels.map(l => {
          const v = data.total_metrics[l];
          return v && v[metricKey] !== undefined ? v[metricKey] : 0;
        });
        const validVals = totalVals.filter(v => v > 0);
        // 原：动态计算均值 if(validVals.length > 0) avgLineVal = validVals.reduce((a,b)=>a+b,0) / validVals.length;
        if(validVals.length > 0) avgLineVal = validVals.reduce((a,b)=>a+b,0) / validVals.length;
      }
      // 固定均值线：图片人均日均产出=70，混剪人均日均产出=30
      if(moduleName === '图片' && m.key === 'avg_daily_output') avgLineVal = 70;
      if(moduleName === '混剪' && m.key === 'avg_daily_output') avgLineVal = 30;
      // 三个模块人均日均产出标准值
      if(moduleName === '内容团队-编剧' && m.key === 'avg_daily_output' && getScriptOutputMode() === 'write') avgLineVal = 8;
      if(moduleName === '内容团队-摄像' && m.key === 'avg_daily_output') avgLineVal = 13;
      if(moduleName === '内容团队-剪辑' && m.key === 'avg_daily_output') avgLineVal = 7;
      sharedMax = sharedMax * 1.25 || 1;
    }

    lineItems.forEach((item, idx) => {
      let yMax = sharedMax;
      if(m.key === 'total_output') {
        let itemMax = 0;
        labels.forEach(l => { const v = item.metrics[l]; if(v && v[metricKey] !== undefined) itemMax = Math.max(itemMax, v[metricKey]); });
        yMax = itemMax * 1.25 || 1;
      }

      const card = document.createElement('div');
      card.className = 'chart-card' + (item.isTotal ? ' is-total' : '');
      // 总计与第一个部门之间加大间距（2倍部门间距）
      if(data.show_total !== false && idx === 1) {
        card.style.marginLeft = '15px';
      }
      // 脚本模块：仅总产出图显示项目数和人均项目数
      let titleExtra = '';
      if (moduleName === SCRIPT_MODULE && m.key === 'total_output') {
        const lastLabel = labels[labels.length - 1];
        const periodMetrics = item.metrics[lastLabel];
        const pc = periodMetrics ? (periodMetrics.project_count || 0) : 0;
        const ppc = periodMetrics ? (periodMetrics.project_per_capita || 0) : 0;
        titleExtra = '<div class="project-info-inline">项目数: ' + pc + ' | 人均: ' + ppc.toFixed(1) + '</div>';
      }
      card.innerHTML = buildChartCardHeader(item.name, titleExtra, moduleName, item.isTotal ? '\u5168\u90e8' : item.name, m.key === 'avg_daily_output' ? 'output' : null);
      const box = document.createElement('div');
      box.className = 'chart-box';
      const canvas = document.createElement('canvas');
      const canvasId = moduleName + '_' + view + '_' + metricKey + '_' + idx;
      canvas.id = canvasId;
      box.appendChild(canvas);
      card.appendChild(box);
      chartsRow.appendChild(card);

      const ctx = canvas.getContext('2d');

      if(m.key === 'total_output') {
        const useNarrowOutputBars = NARROW_OUTPUT_BAR_MODULES.indexOf(moduleName) !== -1;
        const vals = labels.map(l => { const v = item.metrics[l]; return v && v[metricKey] !== undefined ? v[metricKey] : 0; });
        charts[canvasId] = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              data: vals,
              backgroundColor: hexToRgba(item.color, item.isTotal ? 0.9 : 0.8),
              hoverBackgroundColor: hexToRgba(item.color, 0.85),
              borderRadius: 4, borderSkipped: 'bottom',
              barPercentage: useNarrowOutputBars ? 0.75 : 0.9,
              categoryPercentage: useNarrowOutputBars ? 0.85 : 0.95,
              shadowColor: 'rgba(0,0,0,0.18)',
              shadowBlur: 8,
              shadowOffsetX: 0,
              shadowOffsetY: 4,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            layout: { padding: { top: 22 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: false,
                backgroundColor: 'rgba(15,23,42,0.88)',
                titleFont: { size: 12 }, bodyFont: { size: 13, weight: '600' },
                padding: 10, cornerRadius: 8,
                callbacks: { label: c => item.name + ': ' + fmtVal(c.parsed.y, metricKey) }
              },
              datalabels: {
                anchor: 'end', align: 'top', offset: 2,
                color: item.isTotal ? TOTAL_COLOR : hexToRgba(item.color, 0.85),
                font: { size: 12, weight: item.isTotal ? '700' : '600', family: "Microsoft YaHei" },
                formatter: v => fmtVal(v, metricKey),
                backgroundColor: 'rgba(255,255,255,0.68)',
                borderRadius: 4, padding: { top: 2, bottom: 1, left: 4, right: 4 },
              }
            },
            scales: {
              y: { display: false, min: 0, max: yMax },
              x: { ticks: { font: { size: 10, color: '#D9D9D9' } }, grid: { display: false }, border: { display: true, color: '#D9D9D9' } }
            }
          }
        });
      } else {
        createLineChart(canvasId, ctx, item, renderMetric, labels, yMax, avgLineVal, data.show_total !== false, moduleName);
      }
    });

    if(summary) row.appendChild(summary);
    row.appendChild(chartsRow);
    outputGroup.appendChild(row);
  });

  // --- 产出分析区块（产出指标和效率指标之间） ---
  const state = _structureState[moduleName];
  const depts2 = DATA[view][moduleName].depts;
  const sid = moduleName + '_' + view;  // 加view后缀避免月度/周度ID冲突
  let filterBtns2 = '<button class="structure-filter-btn' + (state && state.dept === '全部' ? ' active' : '') + '" data-dept="全部" onclick="switchStructureDept(\'' + moduleName + '\',\'全部\')">全部</button>';
  depts2.forEach(d => {
    filterBtns2 += '<button class="structure-filter-btn' + (state && state.dept === d ? ' active' : '') + '" data-dept="' + d + '" onclick="switchStructureDept(\'' + moduleName + '\',\'' + d + '\')">' + d + '</button>';
  });
  const analysisDiv = document.createElement('div');
  analysisDiv.innerHTML =
    '<div class="structure-toggle">' +
      '<button id="structure_toggle_' + sid + '" class="structure-toggle-btn' + (state && state.open ? ' active' : '') + '" onclick="toggleStructure(\'' + moduleName + '\')">' +
        '<span class="arrow">&#9654;</span> 产出分析' +
      '</button>' +
    '</div>' +
    '<div id="structure_container_' + sid + '" class="structure-container' + (state && state.open ? ' open' : '') + '">' +
      '<div class="structure-inner">' +
        '<div id="structure_title_' + sid + '" class="structure-current-title"></div>' +
        '<div id="structure_filter_' + sid + '" class="structure-filter">' +
          '<span class="structure-filter-label">制作团队：</span>' +
          filterBtns2 +
        '</div>' +
        '<div id="structure_content_' + sid + '"></div>' +
      '</div>' +
    '</div>';
  container.appendChild(analysisDiv);

  // 如果已展开，渲染内容
  if (state && state.open) {
    renderStructureAnalysis(moduleName, view);
  }

  // --- 效率指标区块 ---
  const effGroup = document.createElement('div');
  effGroup.className = 'metric-group';
  effGroup.innerHTML =
    '<div class="group-header">' +
    '<div class="group-title-wrap">' +
    '<div class="group-icon" style="background:linear-gradient(135deg,#10b981,#34d399);color:#fff">&#9889;</div>' +
    '<span class="group-label">效率指标</span>' +
    '<span class="group-desc"> — 饱和度与耗时</span>' +
    '</div>' +
    '</div>';
  container.appendChild(effGroup);

  EFFICIENCY_METRICS.forEach(m => {
    const row = document.createElement('div');
    row.className = 'metric-row';

    let summary = null;
    if(['内容团队-编剧','内容团队-摄像','内容团队-剪辑'].indexOf(moduleName) < 0) {
      summary = document.createElement('div');
      summary.className = 'metric-summary efficiency';
      summary.innerHTML = buildSummaryHTML(m, data, labels, true, deptNames, moduleName);
    }

    const chartsRow = document.createElement('div');
    chartsRow.className = 'charts-row';

    let sharedMax = 0;
    let avgLineVal = null;
    lineItems.forEach(item => {
      labels.forEach(l => {
        const v = item.metrics[l];
        if(v && v[m.key] !== undefined) sharedMax = Math.max(sharedMax, v[m.key]);
      });
    });
    sharedMax = sharedMax * 1.25 || 1;
    if(m.key === 'saturation') sharedMax = Math.max(sharedMax, 1.25);
    if(m.key === 'single_time' && data.total_metrics) {
      const totalVals = labels.map(l => {
        const v = data.total_metrics[l];
        return v && v[m.key] !== undefined ? v[m.key] : 0;
      });
      const validVals = totalVals.filter(v => v > 0);
      // 原：动态计算均值 if(validVals.length > 0) avgLineVal = validVals.reduce((a,b)=>a+b,0) / validVals.length;
      if(validVals.length > 0) avgLineVal = validVals.reduce((a,b)=>a+b,0) / validVals.length;
    }
    // 固定均值线：图片单素材耗时=6，混剪单素材耗时=14
    if(moduleName === '图片' && m.key === 'single_time') avgLineVal = 6;
    if(moduleName === '混剪' && m.key === 'single_time') avgLineVal = 14;
    // 三个模块单素材耗时标准值（仅摄像、剪辑）
    if(moduleName === '内容团队-摄像' && m.key === 'single_time') avgLineVal = 54;
    if(moduleName === '内容团队-剪辑' && m.key === 'single_time') avgLineVal = 60;

    lineItems.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'chart-card' + (item.isTotal ? ' is-total' : '');
      if(data.show_total !== false && idx === 1) {
        card.style.marginLeft = '15px';
      }
      card.innerHTML = buildChartCardHeader(item.name, '', moduleName, item.isTotal ? '\u5168\u90e8' : item.name, m.key === 'single_time' ? 'efficiency' : null);
      const box = document.createElement('div');
      box.className = 'chart-box';
      const canvas = document.createElement('canvas');
      const canvasId = moduleName + '_' + view + '_eff_' + m.key + '_' + idx;
      canvas.id = canvasId;
      box.appendChild(canvas);
      card.appendChild(box);
      chartsRow.appendChild(card);

      createLineChart(canvasId, canvas.getContext('2d'), item, m, labels, sharedMax, avgLineVal, data.show_total !== false, moduleName);
    });

    if(summary) row.appendChild(summary);
    row.appendChild(chartsRow);
    effGroup.appendChild(row);

    if (m.key === 'single_time') {
      const effState = _efficiencyAnalysisState[moduleName];
      const effSid = moduleName + '_' + view;
      const effDepts = data.depts;
      let effFilterBtns = '<button class="structure-filter-btn' + (effState && effState.dept === '全部' ? ' active' : '') + '" data-dept="全部" onclick="switchEfficiencyDept(\'' + moduleName + '\',\'全部\')">全部</button>';
      effDepts.forEach(d => {
        effFilterBtns += '<button class="structure-filter-btn' + (effState && effState.dept === d ? ' active' : '') + '" data-dept="' + d + '" onclick="switchEfficiencyDept(\'' + moduleName + '\',\'' + d + '\')">' + d + '</button>';
      });

      const efficiencyAnalysisDiv = document.createElement('div');
      efficiencyAnalysisDiv.innerHTML =
        '<div class="structure-toggle">' +
          '<button id="efficiency_toggle_' + effSid + '" class="structure-toggle-btn' + (effState && effState.open ? ' active' : '') + '" onclick="toggleEfficiencyAnalysis(\'' + moduleName + '\')">' +
            '<span class="arrow">&#9654;</span> 效率分析' +
          '</button>' +
        '</div>' +
        '<div id="efficiency_container_' + effSid + '" class="structure-container efficiency-analysis-container' + (effState && effState.open ? ' open' : '') + '">' +
          '<div class="structure-inner efficiency-analysis-inner">' +
            '<div id="efficiency_title_' + effSid + '" class="structure-current-title"></div>' +
            '<div id="efficiency_filter_' + effSid + '" class="structure-filter">' +
              '<span class="structure-filter-label">制作团队：</span>' +
              effFilterBtns +
            '</div>' +
            '<div id="efficiency_content_' + effSid + '"></div>' +
          '</div>' +
        '</div>';
      effGroup.appendChild(efficiencyAnalysisDiv);

      if (effState && effState.open) {
        renderEfficiencyAnalysis(moduleName, view);
      }
    }
  });

  // --- 单素材人力成本区块（仅月度、仅图片/混剪） ---
  if (view === 'monthly' && LABOR_COST_MODULES.indexOf(moduleName) !== -1) {
    const lcm = LABOR_COST_METRIC;
    const lcmUnit = LABOR_COST_UNIT[moduleName] || '元';
    const lcmLabel = lcm.label + ' <span class="summary-unit">' + lcmUnit + '</span>';

    const lcGroup = document.createElement('div');
    lcGroup.className = 'metric-group';
    lcGroup.innerHTML =
      '<div class="group-header">' +
      '<div class="group-title-wrap">' +
      '<div class="group-icon" style="background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#fff">&#128176;</div>' +
      '<span class="group-label">成本指标</span>' +
      '<span class="group-desc"> — 单素材人力成本</span>' +
      '</div>' +
      '</div>';

    const lcRow = document.createElement('div');
    lcRow.className = 'metric-row';

    // 左侧KPI摘要
    const lcSummary = document.createElement('div');
    lcSummary.className = 'metric-summary cost';
    lcSummary.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
    lcSummary.style.borderColor = '#fcd34d';

    const lcTotalVals = labels.map(l => data.total_metrics[l] ? (data.total_metrics[l][lcm.key] || 0) : 0);
    const lcTotalCh = calcChange(lcTotalVals);

    let lcSumHTML =
      '<div class="summary-metric-name" style="border-left-color:#f59e0b">' + lcmLabel + '</div>' +
      '<div class="summary-latest num" style="color:#92400e">' + fmtVal(lcTotalVals[lcTotalVals.length - 1], lcm.key) + '</div>';
    if (lcTotalCh) {
      lcSumHTML += '<div class="summary-trend ' + (lcTotalCh.dir === 'up' ? 'up' : 'down') + '">' +
        (lcTotalCh.dir === 'up' ? '&#9650;' : '&#9660;') + ' ' + Math.abs(lcTotalCh.pct) + '% 环比</div>';
    }
    lcSumHTML += '<div class="summary-depts">';
    deptNames.forEach((d, i) => {
      const vals = labels.map(l => data.dept_metrics[d][l] ? (data.dept_metrics[d][l][lcm.key] || 0) : 0);
      const ch = calcChange(vals);
      lcSumHTML += '<div class="summary-dept-row">' +
        '<span class="summary-dept-name"><span class="summary-dept-dot" style="background:' + DEPT_COLORS[i % DEPT_COLORS.length] + '"></span>' +
        '<span class="summary-dept-name-text">' + d + '</span></span>' +
        '<span class="summary-dept-right num">' +
        fmtVal(vals[vals.length - 1], lcm.key) +
        trendHTML(ch) +
        '</span></div>';
    });
    lcSumHTML += '</div>';
    lcSummary.innerHTML = lcSumHTML;

    // 右侧图表
    const lcChartsRow = document.createElement('div');
    lcChartsRow.className = 'charts-row';

    let lcSharedMax = 0;
    let lcAvgLine = null;
    lineItems.forEach(item => {
      labels.forEach(l => {
        const v = item.metrics[l];
        if (v && v[lcm.key] !== undefined) lcSharedMax = Math.max(lcSharedMax, v[lcm.key]);
      });
    });
    // 均值线（用总计的均值）— 原：动态计算
    if (data.total_metrics) {
      const lcValidVals = lcTotalVals.filter(v => v > 0);
      // 原：if (lcValidVals.length > 0) lcAvgLine = lcValidVals.reduce((a,b)=>a+b,0) / lcValidVals.length;
      if (lcValidVals.length > 0) lcAvgLine = lcValidVals.reduce((a,b)=>a+b,0) / lcValidVals.length;
    }
    // 不显示单素材人力成本均值线
    lcAvgLine = null;
    lcSharedMax = lcSharedMax * 1.25 || 1;

    lineItems.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'chart-card' + (item.isTotal ? ' is-total' : '');
      if (data.show_total !== false && idx === 1) {
        card.style.marginLeft = '15px';
      }
      card.innerHTML = buildChartCardHeader(item.name, '', moduleName, item.isTotal ? '\u5168\u90e8' : item.name, null);
      const box = document.createElement('div');
      box.className = 'chart-box';
      const canvas = document.createElement('canvas');
      const canvasId = moduleName + '_' + view + '_lc_' + idx;
      canvas.id = canvasId;
      box.appendChild(canvas);
      card.appendChild(box);
      lcChartsRow.appendChild(card);

      createLineChart(canvasId, canvas.getContext('2d'), item, lcm, labels, lcSharedMax, lcAvgLine, data.show_total !== false, moduleName);
    });

    lcRow.appendChild(lcSummary);
    lcRow.appendChild(lcChartsRow);
    lcGroup.appendChild(lcRow);
    container.appendChild(lcGroup);
  }
}

// ===== 结构分析模块 =====
const SHARE_COLORS = ['#007A8C','#0091A5','#00A3B8','#0f766e','#047857','#059669','#006878','#0CB4C8','#00B8CC','#1d4ed8','#0284c7','#0ea5e9','#10b981','#14b8a6','#0d9488','#065f46','#064e3b','#0891b2','#0e7490','#155e75'];
const _structureState = {}; // { moduleName: { open: bool, dept: '全部', view: 'monthly' } }
const _efficiencyAnalysisState = {}; // { moduleName: { open: bool, dept: '全部', view: 'monthly' } }
let structureCharts = {};

function destroyStructureChart(moduleName, view) {
  const cid = 'shareChart_' + moduleName + '_' + view;
  if (structureCharts[cid]) { structureCharts[cid].destroy(); delete structureCharts[cid]; }
}

function renderStructureAnalysis(moduleName, view) {
  if (!_structureState[moduleName]) return;
  const dept = _structureState[moduleName].dept;
  const structureModuleKey = getStructureModuleKey(moduleName);
  const sd = STRUCTURE_DATA[view] && STRUCTURE_DATA[view][structureModuleKey];
  if (!sd || !sd[dept]) return;
  const info = sd[dept];

  const sid = moduleName + '_' + view;
  const container = document.getElementById('structure_content_' + sid);
  if (!container) return;
  container.innerHTML = '';

  const titleEl = document.getElementById('structure_title_' + sid);
  if (titleEl) {
    const modeText = moduleName === SCRIPT_MODULE ? ' · ' + SCRIPT_OUTPUT_MODES[getScriptOutputMode()].label : '';
    titleEl.innerHTML = '<span>当前分析</span><strong>' + getOverviewDisplayNameV3(moduleName) + ' · ' + dept + ' · ' + getPeriodText(view) + modeText + '</strong>';
  }

  // 横向布局容器
  const layout = document.createElement('div');
  layout.className = 'structure-layout';
  container.appendChild(layout);

  // ---- 左侧：占比分布 ----
  const leftDiv = document.createElement('div');
  leftDiv.className = 'structure-left';
  layout.appendChild(leftDiv);

  const shareSection = document.createElement('div');
  shareSection.className = 'share-section';
  shareSection.innerHTML = '<div class="share-section-title">产出占比分布（' + (view === 'monthly' ? '最近一月' : '最近一周') + '）</div>';
  shareSection.innerHTML = '<div class="share-section-title">产出占比分布 · ' + getLatestPeriodText(view) + '</div>';
  leftDiv.appendChild(shareSection);

  const shareRow = document.createElement('div');
  shareRow.className = 'share-row';
  shareSection.appendChild(shareRow);

  if (info.share_list.length === 0 || info.total_output_share === 0) {
    shareRow.innerHTML = '<div class="volatility-empty">暂无数据</div>';
  } else {
    // 环形图
    const chartWrap = document.createElement('div');
    chartWrap.className = 'share-chart-wrap';
    const canvas = document.createElement('canvas');
    canvas.id = 'shareChart_' + sid;
    chartWrap.appendChild(canvas);
    shareRow.appendChild(chartWrap);

    // 表格明细
    const table = document.createElement('table');
    table.className = 'share-table';
    // 新增表头，人工添加
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr class="share-table-thead-tr">
        <td>需求部门</td>
        <td>产出数</td>
        <td>占比</td>
      </tr>
    `;
    thead.innerHTML = '<tr class="share-table-thead-tr"><td>需求部门</td><td>产出数</td><td>占比</td></tr>';
    table.appendChild(thead);
    info.share_list.forEach((item, i) => {
      const color = SHARE_COLORS[i % SHARE_COLORS.length];
      const pct = info.total_output_share > 0 ? (item.output / info.total_output_share * 100).toFixed(1) : '0.0';
      const tr = document.createElement('tr');
      tr.className = 'share-table-tr';
      tr.innerHTML =
        '<td><span class="share-table-dot" style="background:' + color + '"></span>' +
        '<span class="share-table-name" title="' + item.label + '">' + item.label + '</span></td>' +
        '<td class="share-table-val">' + (item.output % 1 === 0 ? item.output : item.output.toFixed(1)) + '</td>' +
        '<td class="share-table-pct">' + pct + '%</td>';
      table.appendChild(tr);
    });
    shareRow.appendChild(table);

    // 绘制环形图
    destroyStructureChart(moduleName, view);
    const ctx = canvas.getContext('2d');
    const chartData = {
      labels: info.share_list.map(item => item.label),
      datasets: [{
        data: info.share_list.map(item => item.output),
        backgroundColor: info.share_list.map((_, i) => SHARE_COLORS[i % SHARE_COLORS.length]),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      }]
    };
    structureCharts['shareChart_' + sid] = new Chart(ctx, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '55%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15,23,42,0.88)',
            titleFont: { size: 12 },
            bodyFont: { size: 13, weight: '600' },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(c) {
                const pct = info.total_output_share > 0 ? (c.parsed / info.total_output_share * 100).toFixed(1) : '0.0';
                return c.label + ': ' + (c.parsed % 1 === 0 ? c.parsed : c.parsed.toFixed(1)) + ' (' + pct + '%)';
              }
            }
          },
          datalabels: {
            color: '#fff',
            font: { size: 11, weight: '600', family: 'Microsoft YaHei' },
            formatter: function(value) {
              const pct = info.total_output_share > 0 ? (value / info.total_output_share * 100) : 0;
              return pct >= 5 ? pct.toFixed(0) + '%' : '';
            },
            textStrokeColor: 'rgba(0,0,0,0.2)',
            textStrokeWidth: 2,
          }
        },
        animation: { duration: 600, easing: 'easeOutQuart' },
      }
    });
  }

  // ---- 右侧：波动TOP3 ----
  const rightDiv = document.createElement('div');
  rightDiv.className = 'structure-right';
  layout.appendChild(rightDiv);

  const volSection = document.createElement('div');
  volSection.className = 'volatility-section';
  volSection.innerHTML = '<div class="volatility-section-title">&#9650;&#9660; 近两期项目波动TOP3</div>';
  volSection.innerHTML = '<div class="volatility-section-title">近两期项目波动 TOP3</div>';
  rightDiv.appendChild(volSection);

  const volGroup = document.createElement('div');
  volGroup.className = 'volatility-group';
  volSection.appendChild(volGroup);

  // 涨幅列
  const upCol = document.createElement('div');
  upCol.className = 'volatility-col';
  upCol.innerHTML = '<div class="volatility-col-title up">&#9650; 涨幅TOP3</div>';
  upCol.innerHTML = '<div class="volatility-col-title up">&#9650; 增长 TOP3</div>';
  if (info.top_up.length === 0) {
    upCol.innerHTML += '<div class="volatility-empty">暂无增长项目</div>';
  } else {
    info.top_up.forEach(item => {
      const diffStr = '+' + (item.diff % 1 === 0 ? item.diff : item.diff.toFixed(1));
      const pctStr = item.pct !== null ? '+' + item.pct + '%' : '-';
      upCol.innerHTML += '<div class="volatility-card up">' +
        '<div class="volatility-project" title="' + item.project + '">' + item.project + '</div>' +
        '<div class="volatility-nums">' +
          '<span>上期: ' + (item.prev % 1 === 0 ? item.prev : item.prev.toFixed(1)) + '</span>' +
          '<span>本期: ' + (item.curr % 1 === 0 ? item.curr : item.curr.toFixed(1)) + '</span>' +
          '<span class="volatility-diff up">' + diffStr + ' ' + pctStr + '</span>' +
        '</div></div>';
    });
  }
  volGroup.appendChild(upCol);

  // 跌幅列
  const downCol = document.createElement('div');
  downCol.className = 'volatility-col';
  downCol.innerHTML = '<div class="volatility-col-title down">&#9660; 跌幅TOP3</div>';
  downCol.innerHTML = '<div class="volatility-col-title down">&#9660; 下降 TOP3</div>';
  if (info.top_down.length === 0) {
    downCol.innerHTML += '<div class="volatility-empty">暂无下降项目</div>';
  } else {
    info.top_down.forEach(item => {
      const diffStr = (item.diff % 1 === 0 ? item.diff : item.diff.toFixed(1));
      const pctStr = item.pct !== null ? item.pct + '%' : '-';
      downCol.innerHTML += '<div class="volatility-card down">' +
        '<div class="volatility-project" title="' + item.project + '">' + item.project + '</div>' +
        '<div class="volatility-nums">' +
          '<span>上期: ' + (item.prev % 1 === 0 ? item.prev : item.prev.toFixed(1)) + '</span>' +
          '<span>本期: ' + (item.curr % 1 === 0 ? item.curr : item.curr.toFixed(1)) + '</span>' +
          '<span class="volatility-diff down">' + diffStr + ' ' + pctStr + '</span>' +
        '</div></div>';
    });
  }
  volGroup.appendChild(downCol);
}

function toggleStructure(moduleName) {
  const state = _structureState[moduleName];
  if (!state) return;
  state.open = !state.open;
  const sid = moduleName + '_' + state.view;
  const btn = document.getElementById('structure_toggle_' + sid);
  const container = document.getElementById('structure_container_' + sid);
  if (!btn || !container) return;
  if (state.open) {
    btn.classList.add('active');
    container.classList.add('open');
    renderStructureAnalysis(moduleName, state.view);
  } else {
    btn.classList.remove('active');
    container.classList.remove('open');
  }
}

function openStructureAnalysis(moduleName, dept) {
  const state = _structureState[moduleName];
  if (!state) return;
  state.open = true;
  state.dept = dept;
  const sid = moduleName + '_' + state.view;
  const btn = document.getElementById('structure_toggle_' + sid);
  const container = document.getElementById('structure_container_' + sid);
  if (btn) btn.classList.add('active');
  if (container) container.classList.add('open');
  const btns = document.querySelectorAll('#structure_filter_' + sid + ' .structure-filter-btn');
  btns.forEach(b => b.classList.toggle('active', b.getAttribute('data-dept') === dept));
  renderStructureAnalysis(moduleName, state.view);
  if (container) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openEfficiencyAnalysis(moduleName, dept) {
  const state = _efficiencyAnalysisState[moduleName];
  if (!state) return;
  state.open = true;
  state.dept = dept;
  const sid = moduleName + '_' + state.view;
  const btn = document.getElementById('efficiency_toggle_' + sid);
  const container = document.getElementById('efficiency_container_' + sid);
  if (btn) btn.classList.add('active');
  if (container) container.classList.add('open');
  const btns = document.querySelectorAll('#efficiency_filter_' + sid + ' .structure-filter-btn');
  btns.forEach(b => b.classList.toggle('active', b.getAttribute('data-dept') === dept));
  renderEfficiencyAnalysis(moduleName, state.view);
  if (container) container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleEfficiencyAnalysis(moduleName) {
  const state = _efficiencyAnalysisState[moduleName];
  if (!state) return;
  state.open = !state.open;
  const sid = moduleName + '_' + state.view;
  const btn = document.getElementById('efficiency_toggle_' + sid);
  const container = document.getElementById('efficiency_container_' + sid);
  if (!btn || !container) return;
  if (state.open) {
    btn.classList.add('active');
    container.classList.add('open');
    renderEfficiencyAnalysis(moduleName, state.view);
  } else {
    btn.classList.remove('active');
    container.classList.remove('open');
  }
}

function switchEfficiencyDept(moduleName, dept) {
  const state = _efficiencyAnalysisState[moduleName];
  if (!state) return;
  state.dept = dept;
  const sid = moduleName + '_' + state.view;
  const btns = document.querySelectorAll('#efficiency_filter_' + sid + ' .structure-filter-btn');
  btns.forEach(b => b.classList.toggle('active', b.getAttribute('data-dept') === dept));
  renderEfficiencyAnalysis(moduleName, state.view);
}

function switchStructureDept(moduleName, dept) {
  const state = _structureState[moduleName];
  if (!state) return;
  state.dept = dept;
  const sid = moduleName + '_' + state.view;
  // 更新按钮状态
  const btns = document.querySelectorAll('#structure_filter_' + sid + ' .structure-filter-btn');
  btns.forEach(b => b.classList.toggle('active', b.getAttribute('data-dept') === dept));
  renderStructureAnalysis(moduleName, state.view);
}

const MODULE_NAMES = Object.keys(DATA.monthly);
const MODULE_INDEX = Object.fromEntries(MODULE_NAMES.map((name, idx) => [name, idx]));
const appState = {
  mainView: 'overview',
  activeModule: MODULE_NAMES[0],
  modulePeriod: 'monthly',
  businessTab: 'roi',
  scriptOutputMode: 'write',
};
const MODULE_NOTE_STORAGE_KEY = 'creative-weekly-dashboard-module-notes';
const LONG_IMAGE_SELECTION_STORAGE_KEY = 'creative-weekly-dashboard-long-image-pages';
const LONG_IMAGE_MAX_DIMENSION = 30000;
const LONG_IMAGE_CAPTURE_SCALE = 2;
const standaloneCharts = {};

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readModuleNotes() {
  try {
    const raw = window.localStorage.getItem(MODULE_NOTE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

function getModuleToolbarNote(moduleName) {
  const notes = readModuleNotes();
  return typeof notes[moduleName] === 'string' ? notes[moduleName] : '';
}

function updateModuleToolbarNote(moduleName, value) {
  try {
    const notes = readModuleNotes();
    notes[moduleName] = value;
    window.localStorage.setItem(MODULE_NOTE_STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    return;
  }
}

function updateActiveModuleToolbarNote(value) {
  updateModuleToolbarNote(appState.activeModule, value);
}

function getLongImagePageOptions() {
  const moduleOptions = MODULE_NAMES.map(moduleName => ({
    key: 'module:' + moduleName,
    label: getOverviewDisplayNameV3(moduleName) + '\u8be6\u60c5'
  }));
  return [{ key: 'overview', label: '\u603b\u89c8' }]
    .concat(moduleOptions)
    .concat([{ key: 'business', label: '\u6295\u5165\u4ea7\u51fa' }]);
}

function readLongImageSelection() {
  const validKeys = getLongImagePageOptions().map(item => item.key);
  try {
    const stored = JSON.parse(window.localStorage.getItem(LONG_IMAGE_SELECTION_STORAGE_KEY) || '[]');
    const selected = Array.isArray(stored) ? stored.filter(key => validKeys.includes(key)) : [];
    return selected.length ? selected : validKeys;
  } catch (err) {
    return validKeys;
  }
}

function buildLongImageSelectionHtml() {
  const selectedKeys = readLongImageSelection();
  return getLongImagePageOptions().map(item =>
    '<label class="long-image-page-option">' +
      '<input class="long-image-page-checkbox" type="checkbox" value="' + escapeHtmlAttr(item.key) + '"' +
        (selectedKeys.includes(item.key) ? ' checked' : '') + ' />' +
      '<span>' + item.label + '</span>' +
    '</label>'
  ).join('');
}

function openLongImageExportDialog() {
  const dialog = document.getElementById('longImageExportDialog');
  if (!dialog) return;
  const optionList = dialog.querySelector('.long-image-page-list');
  if (optionList) optionList.innerHTML = buildLongImageSelectionHtml();
  dialog.hidden = false;
}

function closeLongImageExportDialog() {
  const dialog = document.getElementById('longImageExportDialog');
  if (dialog) dialog.hidden = true;
}

function getCheckedLongImagePages() {
  const dialog = document.getElementById('longImageExportDialog');
  if (!dialog) return [];
  return Array.from(dialog.querySelectorAll('.long-image-page-checkbox:checked')).map(input => input.value);
}

function showLongImageExportProgress(message) {
  let progress = document.getElementById('longImageExportProgress');
  if (!progress) {
    progress = document.createElement('div');
    progress.id = 'longImageExportProgress';
    progress.className = 'long-image-export-progress';
    progress.innerHTML = '<div class="long-image-export-progress-panel"><span class="long-image-export-spinner"></span><span class="long-image-export-progress-text"></span></div>';
    document.body.appendChild(progress);
  }
  progress.querySelector('.long-image-export-progress-text').textContent = message;
  progress.hidden = false;
}

function hideLongImageExportProgress() {
  const progress = document.getElementById('longImageExportProgress');
  if (progress) progress.hidden = true;
}

function getLongImagePageTitle(pageKey) {
  if (pageKey === 'overview') return '\u603b\u89c8';
  if (pageKey === 'business') return '\u6295\u5165\u4ea7\u51fa';
  const moduleName = pageKey.replace('module:', '');
  return getOverviewDisplayNameV3(moduleName) + '\u8be6\u60c5 | ' + getPeriodText(appState.modulePeriod);
}

function renderLongImagePage(pageKey) {
  if (pageKey === 'overview') {
    appState.mainView = 'overview';
  } else if (pageKey === 'business') {
    appState.mainView = 'business';
  } else {
    appState.mainView = 'modules';
    appState.activeModule = pageKey.replace('module:', '');
  }
  renderApp();
  const viewRoot = document.getElementById('viewRoot');
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'long-image-section-title';
  sectionTitle.textContent = getLongImagePageTitle(pageKey);
  viewRoot.insertBefore(sectionTitle, viewRoot.firstChild);
}

function restoreLongImageViewState(savedState) {
  appState.mainView = savedState.mainView;
  appState.activeModule = savedState.activeModule;
  appState.modulePeriod = savedState.modulePeriod;
  appState.businessTab = savedState.businessTab;
  renderApp();
}

function downloadLongImage(canvas) {
  const link = document.createElement('a');
  const now = new Date();
  const stamp = now.getFullYear() + pad2V3(now.getMonth() + 1) + pad2V3(now.getDate());
  link.download = '\u521b\u610f\u5468\u4f1a\u4eea\u8868\u76d8_\u957f\u56fe_' + stamp + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

async function exportSelectedPagesAsLongImage() {
  const pageKeys = getCheckedLongImagePages();
  if (!pageKeys.length) {
    window.alert('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u9875\u9762\u3002');
    return;
  }
  if (typeof window.html2canvas !== 'function') {
    window.alert('\u957f\u56fe\u5bfc\u51fa\u7ec4\u4ef6\u672a\u52a0\u8f7d\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u5237\u65b0\u9875\u9762\u91cd\u8bd5\u3002');
    return;
  }

  try {
    window.localStorage.setItem(LONG_IMAGE_SELECTION_STORAGE_KEY, JSON.stringify(pageKeys));
  } catch (err) {
    // Continue exporting when local storage is unavailable.
  }

  const savedState = {
    mainView: appState.mainView,
    activeModule: appState.activeModule,
    modulePeriod: appState.modulePeriod,
    businessTab: appState.businessTab
  };
  const previousAnimation = Chart.defaults && Chart.defaults.animation;
  const captures = [];
  closeLongImageExportDialog();
  document.body.classList.add('long-image-export-mode');

  try {
    if (Chart.defaults) Chart.defaults.animation = false;
    for (let index = 0; index < pageKeys.length; index += 1) {
      document.body.classList.toggle('long-image-export-continuation', index > 0);
      renderLongImagePage(pageKeys[index]);
      showLongImageExportProgress('\u6b63\u5728\u751f\u6210\u957f\u56fe ' + (index + 1) + '/' + pageKeys.length);
      await new Promise(resolve => window.setTimeout(resolve, 100));
      const capture = await window.html2canvas(document.querySelector('.container'), {
        backgroundColor: '#f8fbfd',
        scale: LONG_IMAGE_CAPTURE_SCALE,
        useCORS: true,
        logging: false
      });
      captures.push(capture);
    }

    const rawWidth = Math.max(...captures.map(canvas => canvas.width));
    const rawHeight = captures.reduce((total, canvas) => total + canvas.height, 0);
    const scale = Math.min(1, LONG_IMAGE_MAX_DIMENSION / rawWidth, LONG_IMAGE_MAX_DIMENSION / rawHeight);
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = Math.max(1, Math.round(rawWidth * scale));
    resultCanvas.height = Math.max(1, Math.round(rawHeight * scale));
    const context = resultCanvas.getContext('2d');
    context.fillStyle = '#f8fbfd';
    context.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
    let offsetY = 0;
    captures.forEach(canvas => {
      const drawHeight = Math.round(canvas.height * scale);
      context.drawImage(canvas, 0, offsetY, Math.round(canvas.width * scale), drawHeight);
      offsetY += drawHeight;
    });
    downloadLongImage(resultCanvas);
  } catch (err) {
    console.error(err);
    window.alert('\u957f\u56fe\u751f\u6210\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5\u3002');
  } finally {
    if (Chart.defaults) Chart.defaults.animation = previousAnimation;
    document.body.classList.remove('long-image-export-mode', 'long-image-export-continuation');
    hideLongImageExportProgress();
    restoreLongImageViewState(savedState);
  }
}

function destroyStandaloneCharts() {
  Object.keys(standaloneCharts).forEach(key => {
    standaloneCharts[key].destroy();
    delete standaloneCharts[key];
  });
}

function destroyAllRenderedCharts() {
  Object.keys(charts).forEach(key => {
    charts[key].destroy();
    delete charts[key];
  });
  Object.keys(structureCharts).forEach(key => {
    structureCharts[key].destroy();
    delete structureCharts[key];
  });
  destroyStandaloneCharts();
}

function renderBusinessPage(container) {
  const activeClassRoi = appState.businessTab === 'roi' ? ' active' : '';
  const activeClassCost = appState.businessTab === 'cost' ? ' active' : '';
  container.innerHTML =
    '<section class="business-page">' +
      '<div class="page-head">' +
        '<div>' +
          '<h2 class="page-title">ROI 与成本专题</h2>' +
          '<p class="page-desc">把制作效率和经营结果分层展示，避免和模块页互相抢信息。</p>' +
        '</div>' +
      '</div>' +
      '<div class="business-tab-bar">' +
        '<button class="business-tab-btn' + activeClassRoi + '" onclick="setBusinessTab(\'roi\')">ROI 趋势</button>' +
        '<button class="business-tab-btn' + activeClassCost + '" onclick="setBusinessTab(\'cost\')">成本专题</button>' +
      '</div>' +
      '<div id="businessContent"></div>' +
    '</section>';

  const businessContent = document.getElementById('businessContent');
  if (appState.businessTab === 'roi') {
    buildROIChart(businessContent);
  } else {
    renderLaborCostTopic(businessContent);
  }
}

function renderLaborCostTopic(container) {
  const latestMonth = MONTH_LABELS[MONTH_LABELS.length - 1];
  const cards = LABOR_COST_MODULES.map(moduleName => {
    const value = DATA.monthly[moduleName].total_metrics[latestMonth] ? (DATA.monthly[moduleName].total_metrics[latestMonth].single_labor_cost || 0) : 0;
    return '<div class="overview-card business-card">' +
      '<div class="overview-card-label">' + moduleName + '单素材人力成本</div>' +
      '<div class="overview-card-value num">' + fmtVal(value, 'single_labor_cost') + ' ' + LABOR_COST_UNIT[moduleName] + '</div>' +
      '<div class="overview-card-hint">取最近月份总计口径</div>' +
    '</div>';
  }).join('');

  container.innerHTML =
    '<div class="business-cost-page">' +
      '<div class="overview-kpis">' + cards + '</div>' +
      '<div class="overview-panel business-panel"><div class="overview-panel-title">近四月单素材人力成本趋势</div><div class="overview-chart-box"><canvas id="laborCostTrendChart"></canvas></div></div>' +
    '</div>';

  const ctx = document.getElementById('laborCostTrendChart').getContext('2d');
  standaloneCharts.laborCostTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MONTH_LABELS,
      datasets: LABOR_COST_MODULES.map((moduleName, idx) => ({
        label: moduleName,
        data: MONTH_LABELS.map(month => {
          const monthMetrics = DATA.monthly[moduleName].total_metrics[month];
          return monthMetrics ? (monthMetrics.single_labor_cost || 0) : 0;
        }),
        borderColor: DEPT_COLORS[idx + 2],
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointRadius: 4,
        tension: 0.3,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top' } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7280' } },
        y: { beginAtZero: true, ticks: { color: '#6b7280' } }
      }
    }
  });
}

function buildROIChart(container) {
  var modEl = document.createElement('div');
  modEl.className = 'roi-module';

  var months = ROI_DATA.months;

  var headerHTML =
    '<div class="roi-module-header">' +
      '<div class="roi-module-icon">💰</div>' +
      '<span class="roi-module-title">部门ROI趋势</span>' +
    '</div>';

  var chartsHTML = '<div class="roi-charts-grid">';
  ROI_DATA.depts.forEach(function(dept, i) {
    var color = ROI_COLORS[i] || ROI_COLORS[0];
    var annualROI = ROI_DATA.annual_roi[dept] !== undefined ? ROI_DATA.annual_roi[dept] : 0;
    chartsHTML +=
      '<div class="roi-dept-card">' +
        '<div class="roi-dept-title" style="border-left:4px solid ' + color + '">' +
          '<span class="roi-dept-name">' + dept + '</span>' +
          '<span class="roi-dept-annual">年度ROI: ' + annualROI.toFixed(2) + '</span>' +
        '</div>' +
        '<div class="roi-chart-box"><canvas id="roiChart_' + i + '"></canvas></div>' +
      '</div>';
  });
  chartsHTML += '</div>';

  modEl.innerHTML = headerHTML + chartsHTML;
  container.appendChild(modEl);

  ROI_DATA.depts.forEach(function(dept, i) {
    var color = ROI_COLORS[i] || ROI_COLORS[0];
    var data = months.map(function(m) { return ROI_DATA.values[dept][m] || 0; });
    var dataMax = Math.max.apply(null, data.concat([1.1]));
    standaloneCharts['roiChart_' + i] = new Chart(document.getElementById('roiChart_' + i), {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          data: data,
          borderColor: color,
          backgroundColor: color + '18',
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2.5,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.88)',
            titleFont: { family: "'Noto Sans SC','Microsoft YaHei',sans-serif" },
            bodyFont: { family: "'Microsoft YaHei',sans-serif" },
            callbacks: {
              label: function(ctx) { return ctx.parsed.y.toFixed(2); }
            }
          },
          datalabels: {
            display: true,
            color: '#374151',
            font: { size: 11, weight: '600', family: "'Microsoft YaHei',sans-serif" },
            anchor: 'end',
            align: 'top',
            offset: 4,
            formatter: function(v) { return v.toFixed(2); }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: {
              font: { size: 13, family: "'Noto Sans SC','Microsoft YaHei',sans-serif" },
              color: '#6b7280'
            }
          },
          y: {
            beginAtZero: true,
            max: dataMax * 1.15,
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: {
              font: { size: 12, family: "'Microsoft YaHei',sans-serif" },
              color: '#6b7280',
              callback: function(v) { return v.toFixed(1); }
            }
          }
        }
      },
      plugins: [{
        id: 'roiBaseline',
        afterDraw: function(chart) {
          var yScale = chart.scales.y;
          var yPixel = yScale.getPixelForValue(1.0);
          var ctx = chart.ctx;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(chart.chartArea.left, yPixel);
          ctx.lineTo(chart.chartArea.right, yPixel);
          ctx.strokeStyle = 'rgba(220,38,38,0.5)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.fillStyle = 'rgba(220,38,38,0.7)';
          ctx.font = "600 11px 'Microsoft YaHei',sans-serif";
          ctx.textAlign = 'right';
          ctx.fillText('ROI 1.0', chart.chartArea.right, yPixel - 5);
          ctx.restore();
        }
      }, ChartDataLabels]
    });
  });
}


function renderApp() {
  destroyAllRenderedCharts();
  renderShell();
  const viewRoot = document.getElementById('viewRoot');
  if (appState.mainView === 'overview') {
    renderOverviewPage(viewRoot);
  } else if (appState.mainView === 'modules') {
    renderModuleShell(viewRoot);
  } else {
    renderBusinessPage(viewRoot);
  }
}

function setMainView(view) {
  appState.mainView = view;
  renderApp();
}

function openModuleView(moduleName) {
  appState.mainView = 'modules';
  appState.activeModule = moduleName;
  renderApp();
}

function setActiveModule(moduleName) {
  appState.activeModule = moduleName;
  renderApp();
}

function switchModulePeriod(view) {
  appState.modulePeriod = view;
  renderApp();
}

function switchScriptOutputMode(mode) {
  if (!SCRIPT_OUTPUT_MODES[mode] || appState.scriptOutputMode === mode) return;
  appState.scriptOutputMode = mode;
  if (appState.mainView === 'modules' && appState.activeModule === SCRIPT_MODULE) {
    renderApp();
  }
}

function setBusinessTab(tab) {
  appState.businessTab = tab;
  renderApp();
}

// Initial render runs after the overview v2 overrides below.

// ===== Overview v2: latest-month health cards + weekly signal matrix =====
const OVERVIEW_MONTH_WINDOW_V2 = 4;
const OVERVIEW_WEEK_WINDOW_V2 = 4;
const OVERVIEW_MODULE_ICONS_V2 = ['图', '混', '编', '摄', '剪'];

function overviewAverageV2(values) {
  const valid = values.filter(v => typeof v === 'number' && !Number.isNaN(v));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function getPeriodMetricsV2(moduleName, view, metricKey, labels) {
  const moduleData = DATA[view] && DATA[view][moduleName];
  if (!moduleData) return labels.map(() => 0);
  return labels.map(label => {
    const metrics = moduleData.total_metrics[label];
    return metrics && metrics[metricKey] !== undefined ? metrics[metricKey] : 0;
  });
}

function formatTrendDeltaV2(ratio) {
  const pct = Math.abs((ratio - 1) * 100);
  return pct < 1 ? '0%' : pct.toFixed(0) + '%';
}


function buildMatrixCellV2(status) {
  return '<div class="matrix-pill tone-' + status.tone + '">' + status.label + '</div>' +
    '<div class="matrix-detail">' + (status.detail || '') + '</div>';
}


// ===== Overview v3: clearer period labels and business-facing navigation =====
const OVERVIEW_TEXT_V3 = {
  overview: '\u603b\u89c8',
  materialTrends: '\u56e2\u961f\u8be6\u60c5',
  inputOutput: '\u6295\u5165\u4ea7\u51fa',
  pageDesc: '\u9876\u90e8\u770b\u6700\u65b0\u6708\u8d1f\u8377\u72b6\u6001\uff0c\u4e2d\u90e8\u770b\u8fd1\u56db\u5468\u8282\u594f\u53d8\u5316\uff0c\u5e95\u90e8\u6c47\u603b\u672c\u671f\u5173\u6ce8\u3002',
  latestMonth: '\u6700\u65b0\u6708',
  latestWeek: '\u6700\u65b0\u5468',
  recentFourWeeks: '\u8fd1\u56db\u5468',
  previousThreeWeeks: '\u524d\u4e09\u5468',
  outputStandard: '\u4ea7\u51fa\u6807\u51c6',
  avgDailyOutput: '\u4eba\u5747\u65e5\u5747\u4ea7\u51fa',
  saturation: '\u9971\u548c\u5ea6',
  matrixTitle: '\u7d20\u6750\u6307\u6807\u77e9\u9635',
  materialType: '\u7d20\u6750\u7c7b\u578b',
  saturationStatus: '\u9971\u548c\u5ea6\u72b6\u6001',
  saturationDrift: '\u8f83\u8fd1\u56db\u5468\u5e38\u6001\u504f\u79bb',
  weeklyOutputTrend: '\u5468\u4ea7\u51fa\u8d8b\u52bf',
  volatility: '\u6ce2\u52a8\u7a0b\u5ea6',
  attentionTitle: '\u672c\u671f\u5173\u6ce8\u6458\u8981',
  attentionSubtitle: '\u4f18\u5148\u5217\u51fa\u8d1f\u8377\u5f02\u5e38\u3001\u8282\u594f\u53d8\u5316\u548c\u6ce2\u52a8\u660e\u663e\u7684\u7d20\u6750\u7c7b\u578b\u3002',
  attentionEmpty: '\u672c\u671f\u6682\u65e0\u660e\u663e\u5f02\u5e38\uff0c\u5404\u7c7b\u7d20\u6750\u8282\u594f\u76f8\u5bf9\u5e73\u7a33\u3002',
  lowLoad: '\u8fc7\u4f4e\u8d1f\u8377',
  underUtilized: '\u5229\u7528\u4e0d\u8db3',
  balanced: '\u57fa\u672c\u9971\u548c',
  highLoad: '\u9ad8\u8d1f\u8377',
  low: '\u504f\u4f4e',
  high: '\u504f\u9ad8',
  normal: '\u6b63\u5e38',
  insufficient: '\u6837\u672c\u4e0d\u8db3',
  down: '\u4e0b\u964d',
  up: '\u4e0a\u5347',
  stable: '\u5e73\u7a33',
  stableVolatility: '\u7a33\u5b9a',
  volatile: '\u6ce2\u52a8',
  severe: '\u5267\u70c8'
};

function pad2V3(value) {
  return String(value).padStart(2, '0');
}

function formatUtcMMDDV3(date) {
  return pad2V3(date.getUTCMonth() + 1) + pad2V3(date.getUTCDate());
}

function formatUtcMMDDRangeV3(start, end, separator) {
  return formatUtcMMDDV3(start) + separator + formatUtcMMDDV3(end);
}

function addUtcDaysV3(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getMonthRangeLabelV3(monthKey) {
  const parts = String(monthKey || '').split('-');
  if (parts.length !== 2) return monthKey || '-';
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return monthKey || '-';
  const firstDate = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let endDate = new Date(Date.UTC(year, month - 1, lastDay));
  const latestWeek = WEEK_LABELS[WEEK_LABELS.length - 1];
  const latestWeekEnd = getWeekEndDateV3(latestWeek);
  if (monthKey === MONTH_LABELS[MONTH_LABELS.length - 1] && latestWeekEnd && latestWeekEnd < endDate) {
    endDate = latestWeekEnd;
  }
  return monthKey + ' | ' + formatUtcMMDDRangeV3(firstDate, endDate, '~');
}

function getIsoWeekStartV3(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const weekOneMonday = addUtcDaysV3(jan4, 1 - jan4Day);
  return addUtcDaysV3(weekOneMonday, (week - 1) * 7);
}

function parseWeekKeyV3(weekKey) {
  const match = String(weekKey || '').toUpperCase().match(/(\d{2,4})\D*W(\d{1,2})/);
  if (!match) return null;
  let year = Number(match[1]);
  if (year < 100) year += 2000;
  return { year, week: Number(match[2]) };
}

function getWeekEndDateV3(weekKey) {
  const parsed = parseWeekKeyV3(weekKey);
  if (!parsed) return null;
  return addUtcDaysV3(getIsoWeekStartV3(parsed.year, parsed.week), 6);
}

function getWeekRangeLabelV3(weekKey) {
  const parsed = parseWeekKeyV3(weekKey);
  if (!parsed) return weekKey || '-';
  const start = getIsoWeekStartV3(parsed.year, parsed.week);
  const end = getWeekEndDateV3(weekKey);
  return weekKey + ' | ' + formatUtcMMDDRangeV3(start, end, '-');
}

function getWeekSpanLabelV3(weekLabels) {
  if (!weekLabels.length) return '-';
  const firstParsed = parseWeekKeyV3(weekLabels[0]);
  const lastParsed = parseWeekKeyV3(weekLabels[weekLabels.length - 1]);
  if (!firstParsed || !lastParsed) return weekLabels[0] + '-' + weekLabels[weekLabels.length - 1];
  const start = getIsoWeekStartV3(firstParsed.year, firstParsed.week);
  const end = addUtcDaysV3(getIsoWeekStartV3(lastParsed.year, lastParsed.week), 6);
  return weekLabels[0] + '-' + weekLabels[weekLabels.length - 1] + ' | ' + formatUtcMMDDV3(start) + '-' + formatUtcMMDDV3(end);
}

function getOverviewDisplayNameV3(moduleName) {
  return String(moduleName || '').replace('内容团队-', '');
}

function formatOverviewMetricV3(value, metricKey, moduleName) {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  if (metricKey === 'avg_daily_output') {
    return moduleName === '图片' || moduleName === '混剪' ? Math.round(value).toString() : Number(value).toFixed(1);
  }
  if (metricKey === 'saturation') return Math.round(value * 100) + '%';
  return fmtVal(value, metricKey);
}

function buildModuleIdentityHtmlV3(moduleName, idx, extraClass) {
  return '<span class="module-identity ' + (extraClass || '') + '">' +
    '<span class="module-entry-icon" style="background:' + (MODULE_BG[idx] || MODULE_BG[0]) + '">' + (MODULE_ICONS[idx] || OVERVIEW_MODULE_ICONS_V2[idx] || '📊') + '</span>' +
    '<span class="module-health-name">' + getOverviewDisplayNameV3(moduleName) + '</span>' +
  '</span>';
}

function getSaturationPrimaryStatusV2(value) {
  if (value < 0.8) return { label: OVERVIEW_TEXT_V3.lowLoad, tone: 'idle', detail: '低于 80%' };
  if (value < 1) return { label: OVERVIEW_TEXT_V3.underUtilized, tone: 'underutilized', detail: '80%-100%' };
  if (value <= 1.2) return { label: OVERVIEW_TEXT_V3.balanced, tone: 'balanced', detail: '100%-120%' };
  return { label: OVERVIEW_TEXT_V3.highLoad, tone: 'high', detail: '高于 120%' };
}

function getMonthlyBaselineHintV2(value, baseline) {
  if (!baseline) return '近四月样本不足';
  if (value < baseline * 0.8) return '低于近四月均值 20% 以上';
  if (value > baseline * 1.2) return '高于近四月均值 20% 以上';
  return '接近近四月常态';
}

function getMatrixDeviationStatusV2(value, baseline) {
  if (!baseline) return { label: OVERVIEW_TEXT_V3.insufficient, tone: 'neutral', detail: '近四周样本不足' };
  if (value < baseline * 0.8) return { label: OVERVIEW_TEXT_V3.low, tone: 'low', detail: '低于近四周均值 20% 以上' };
  if (value > baseline * 1.2) return { label: OVERVIEW_TEXT_V3.high, tone: 'high', detail: '高于近四周均值 20% 以上' };
  return { label: OVERVIEW_TEXT_V3.normal, tone: 'balanced', detail: '接近近四周均值' };
}

function getWeeklyOutputTrendStatusV2(latestValue, priorAverage) {
  if (!priorAverage) return { label: OVERVIEW_TEXT_V3.insufficient, tone: 'neutral', detail: '近四周样本不足' };
  if (latestValue < priorAverage * 0.8) return { label: OVERVIEW_TEXT_V3.down, tone: 'low', detail: '较前三周均值低 ' + formatTrendDeltaV2(latestValue / priorAverage) };
  if (latestValue > priorAverage * 1.2) return { label: OVERVIEW_TEXT_V3.up, tone: 'positive', detail: '较前三周均值高 ' + formatTrendDeltaV2(latestValue / priorAverage) };
  return { label: OVERVIEW_TEXT_V3.stable, tone: 'balanced', detail: '与前三周均值接近' };
}

function getWeeklyVolatilityStatusV2(values) {
  const valid = values.filter(value => value > 0);
  if (valid.length < 2) return { label: OVERVIEW_TEXT_V3.insufficient, tone: 'neutral', detail: '近四周样本不足' };
  const ratio = Math.max(...valid) / Math.min(...valid);
  if (ratio <= 1.2) return { label: OVERVIEW_TEXT_V3.stableVolatility, tone: 'balanced', detail: '四周波动较小' };
  if (ratio <= 1.5) return { label: OVERVIEW_TEXT_V3.volatile, tone: 'watch', detail: '最高周约为最低周 ' + ratio.toFixed(1) + ' 倍' };
  return { label: OVERVIEW_TEXT_V3.severe, tone: 'high', detail: '最高周约为最低周 ' + ratio.toFixed(1) + ' 倍' };
}

function buildOverviewCardHtmlV2(card, idx) {
  return '<button class="module-health-card tone-' + card.primary.tone + '" onclick="openModuleView(\'' + card.moduleName + '\')">' +
    '<div class="module-health-top">' +
      buildModuleIdentityHtmlV3(card.moduleName, idx, 'module-health-identity') +
      '<span class="health-status-badge tone-' + card.primary.tone + '">' + card.primary.label + '</span>' +
    '</div>' +
    '<div class="module-health-metrics">' +
      '<div class="module-health-metric">' +
        '<span class="module-health-label">' + OVERVIEW_TEXT_V3.avgDailyOutput + '</span>' +
        '<span class="module-health-value num">' + formatOverviewMetricV3(card.avgDailyOutput, 'avg_daily_output', card.moduleName) + '</span>' +
      '</div>' +
      '<div class="module-health-metric">' +
        '<span class="module-health-label">' + OVERVIEW_TEXT_V3.saturation + '</span>' +
        '<span class="module-health-value num">' + formatOverviewMetricV3(card.saturation, 'saturation', card.moduleName) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="module-health-foot">' +
      '<span class="module-health-hint">' + card.baselineHint + '</span>' +
    '</div>' +
  '</button>';
}

function buildSaturationLegendHtmlV3() {
  const items = [
    { label: OVERVIEW_TEXT_V3.lowLoad, range: '\u4f4e\u4e8e 80%', tone: 'idle' },
    { label: OVERVIEW_TEXT_V3.underUtilized, range: '80% \u81f3\u4f4e\u4e8e 100%', tone: 'underutilized' },
    { label: OVERVIEW_TEXT_V3.balanced, range: '100% \u81f3 120%', tone: 'balanced' },
    { label: OVERVIEW_TEXT_V3.highLoad, range: '\u9ad8\u4e8e 120%', tone: 'high' }
  ];
  return '<div class="saturation-legend" aria-label="\u9971\u548c\u5ea6\u72b6\u6001\u8303\u56f4">' +
    '<span class="saturation-legend-title">\u9971\u548c\u5ea6\u72b6\u6001\u8303\u56f4</span>' +
    items.map(item =>
      '<span class="saturation-legend-item tone-' + item.tone + '">' +
        '<span class="saturation-legend-dot"></span>' +
        '<span class="saturation-legend-label">' + item.label + '</span>' +
        '<span class="saturation-legend-range">' + item.range + '</span>' +
      '</span>'
    ).join('') +
  '</div>';
}

function buildOverviewModelV2() {
  const monthLabels = MONTH_LABELS.slice(-OVERVIEW_MONTH_WINDOW_V2);
  const weekLabels = WEEK_LABELS.slice(-OVERVIEW_WEEK_WINDOW_V2);

  const cards = MODULE_NAMES.map(moduleName => {
    const monthlyAvgOutput = getPeriodMetricsV2(moduleName, 'monthly', 'avg_daily_output', monthLabels);
    const monthlySaturation = getPeriodMetricsV2(moduleName, 'monthly', 'saturation', monthLabels);
    const latestAvgOutput = monthlyAvgOutput[monthlyAvgOutput.length - 1] || 0;
    const latestSaturation = monthlySaturation[monthlySaturation.length - 1] || 0;
    const saturationBaseline = overviewAverageV2(monthlySaturation);
    return {
      moduleName,
      avgDailyOutput: latestAvgOutput,
      saturation: latestSaturation,
      saturationBaseline,
      primary: getSaturationPrimaryStatusV2(latestSaturation),
      baselineHint: getMonthlyBaselineHintV2(latestSaturation, saturationBaseline)
    };
  });

  const matrixRows = MODULE_NAMES.map(moduleName => {
    const weeklySaturation = getPeriodMetricsV2(moduleName, 'weekly', 'saturation', weekLabels);
    const weeklyOutput = getPeriodMetricsV2(moduleName, 'weekly', 'total_output', weekLabels);
    const latestSaturation = weeklySaturation[weeklySaturation.length - 1] || 0;
    const saturationBaseline = overviewAverageV2(weeklySaturation);
    const latestOutput = weeklyOutput[weeklyOutput.length - 1] || 0;
    const previousOutputAvg = overviewAverageV2(weeklyOutput.slice(0, -1));
    return {
      moduleName,
      saturationStatus: getSaturationPrimaryStatusV2(latestSaturation),
      saturationDrift: getMatrixDeviationStatusV2(latestSaturation, saturationBaseline),
      outputTrend: getWeeklyOutputTrendStatusV2(latestOutput, previousOutputAvg),
      volatility: getWeeklyVolatilityStatusV2(weeklyOutput)
    };
  });

  return { monthLabels, weekLabels, cards, matrixRows };
}


function renderOverviewPage(container) {
  const model = buildOverviewModelV2();
  const latestMonth = model.monthLabels[model.monthLabels.length - 1] || '';
  const latestWeek = model.weekLabels[model.weekLabels.length - 1] || '';
  const monthRangeLabel = getMonthRangeLabelV3(latestMonth);
  const latestWeekRangeLabel = getWeekRangeLabelV3(latestWeek);
  const weekSpanLabel = getWeekSpanLabelV3(model.weekLabels);
  const previousWeeksLabel = model.weekLabels.length > 1 ? getWeekSpanLabelV3(model.weekLabels.slice(0, -1)) : '-';

  container.innerHTML =
    '<section class="overview-page overview-page-v2">' +
      '<div class="overview-panel module-health-panel">' +
        '<div class="overview-panel-head">' +
          '<div class="overview-panel-title">\u6708\u5ea6\u9971\u548c\u5ea6</div>' +
          '<div class="overview-panel-subtitle period-range-callout overview-period-callout">' + OVERVIEW_TEXT_V3.latestMonth + ' ' + monthRangeLabel + '</div>' +
        '</div>' +
      buildSaturationLegendHtmlV3() +
      '<div class="module-health-grid">' +
        model.cards.map((card, idx) => buildOverviewCardHtmlV2(card, idx, monthRangeLabel)).join('') +
      '</div>' +
      '</div>' +
      '<div class="overview-panel overview-matrix-panel">' +
        '<div class="overview-panel-head">' +
          '<div class="overview-panel-title">\u5468\u5ea6\u9971\u548c\u5ea6</div>' +
        '</div>' +
        '<div class="overview-matrix-wrap">' +
          '<table class="overview-matrix-table">' +
            '<thead><tr>' +
              '<th>' + OVERVIEW_TEXT_V3.materialType + '</th>' +
              '<th>' + OVERVIEW_TEXT_V3.saturationStatus + '<span class="matrix-range-note">' + OVERVIEW_TEXT_V3.latestWeek + ' ' + latestWeekRangeLabel + '</span></th>' +
              '<th>' + OVERVIEW_TEXT_V3.saturationDrift + '<span class="matrix-range-note">' + OVERVIEW_TEXT_V3.recentFourWeeks + ' ' + weekSpanLabel + '</span></th>' +
              '<th>' + OVERVIEW_TEXT_V3.weeklyOutputTrend + '<span class="matrix-range-note">' + latestWeek + ' vs ' + previousWeeksLabel + '</span></th>' +
              '<th>' + OVERVIEW_TEXT_V3.volatility + '<span class="matrix-range-note">' + OVERVIEW_TEXT_V3.recentFourWeeks + ' ' + weekSpanLabel + '</span></th>' +
            '</tr></thead>' +
            '<tbody>' +
              model.matrixRows.map((row, idx) =>
                '<tr>' +
                  '<td><button class="matrix-module-btn" onclick="openModuleView(\'' + row.moduleName + '\')">' + buildModuleIdentityHtmlV3(row.moduleName, idx, 'matrix-module-identity') + '</button></td>' +
                  '<td>' + buildMatrixCellV2(row.saturationStatus) + '</td>' +
                  '<td>' + buildMatrixCellV2(row.saturationDrift) + '</td>' +
                  '<td>' + buildMatrixCellV2(row.outputTrend) + '</td>' +
                  '<td>' + buildMatrixCellV2(row.volatility) + '</td>' +
                '</tr>'
              ).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
    '</section>';
}

function renderShell() {
  const moduleNavButtons = MODULE_NAMES.map((moduleName, idx) => {
    const activeClass = appState.mainView === 'modules' && moduleName === appState.activeModule ? ' active' : '';
    const ariaCurrent = activeClass ? ' aria-current="page"' : '';
    return '<button class="top-nav-btn module-nav-btn' + activeClass + '" type="button" title="' + getOverviewDisplayNameV3(moduleName) + '" onclick="openModuleView(\'' + moduleName + '\')"'+ ariaCurrent +'>' +
      '<span class="top-nav-label">' + getOverviewDisplayNameV3(moduleName) + '</span>' +
    '</button>';
  }).join('');

  const overviewActive = appState.mainView === 'overview' ? ' active' : '';
  const businessActive = appState.mainView === 'business' ? ' active' : '';
  const app = document.getElementById('app');
  app.innerHTML =
    '<div class="bi-shell">' +
      '<div class="top-nav top-nav-v2">' +
        '<button class="top-nav-btn top-nav-primary' + overviewActive + '" type="button" onclick="setMainView(\'overview\')"'+ (overviewActive ? ' aria-current="page"' : '') +'>' + OVERVIEW_TEXT_V3.overview + '</button>' +
        '<div class="top-nav-section" aria-label="素材模块">' + moduleNavButtons + '</div>' +
        '<button class="top-nav-btn top-nav-primary' + businessActive + '" type="button" onclick="setMainView(\'business\')"'+ (businessActive ? ' aria-current="page"' : '') +'>' + OVERVIEW_TEXT_V3.inputOutput + '</button>' +
        '<button class="top-nav-btn top-nav-export-btn" type="button" onclick="openLongImageExportDialog()">\u5bfc\u51fa\u957f\u56fe</button>' +
      '</div>' +
      '<div id="viewRoot"></div>' +
      '<div id="longImageExportDialog" class="long-image-export-dialog" hidden onclick="closeLongImageExportDialog()">' +
        '<div class="long-image-export-panel" role="dialog" aria-modal="true" aria-label="\u5bfc\u51fa\u957f\u56fe" onclick="event.stopPropagation()">' +
          '<div class="long-image-export-head">' +
            '<div class="long-image-export-title">\u5bfc\u51fa\u957f\u56fe</div>' +
            '<button class="long-image-export-close" type="button" aria-label="\u5173\u95ed" onclick="closeLongImageExportDialog()">\u00d7</button>' +
          '</div>' +
          '<div class="long-image-export-desc">\u9009\u62e9\u8981\u62fc\u63a5\u7684\u9875\u9762\uff0c\u8be6\u60c5\u9875\u4f7f\u7528\u5f53\u524d\u7684\u6708\u5ea6\u6216\u5468\u5ea6\u89c6\u56fe\u3002</div>' +
          '<div class="long-image-page-list">' + buildLongImageSelectionHtml() + '</div>' +
          '<div class="long-image-export-actions">' +
            '<button class="long-image-export-btn secondary" type="button" onclick="closeLongImageExportDialog()">\u53d6\u6d88</button>' +
            '<button class="long-image-export-btn primary" type="button" onclick="exportSelectedPagesAsLongImage()">\u751f\u6210\u957f\u56fe</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function renderModuleShell(container) {
  const activeModule = appState.activeModule;
  const activeIdx = MODULE_INDEX[activeModule];
  const monthlyDisplay = appState.modulePeriod === 'monthly' ? '' : ' style="display:none"';
  const weeklyDisplay = appState.modulePeriod === 'weekly' ? '' : ' style="display:none"';
  const latestWeek = WEEK_LABELS[WEEK_LABELS.length - 1] || '';
  const moduleToolbarNote = getModuleToolbarNote(activeModule);
  const latestWeekHint = appState.modulePeriod === 'weekly' && latestWeek
    ? '<div class="period-range-callout">最新周 ' + getWeekRangeLabelV3(latestWeek) + '</div>'
    : '';
  const moduleToolbarNoteInput =
    '<input class="module-toolbar-note-input" type="text" value="' + escapeHtmlAttr(moduleToolbarNote) + '" ' +
    'placeholder="输入本页说明" oninput="updateActiveModuleToolbarNote(this.value)" />';

  container.innerHTML =
    '<section class="module-page module-page-v2">' +
      '<div class="module">' +
        '<div class="module-header module-toolbar">' +
          '<div class="module-toolbar-left">' +
            latestWeekHint +
            moduleToolbarNoteInput +
          '</div>' +
          '<div class="toggle-btns">' +
            '<button class="toggle-btn' + (appState.modulePeriod === 'monthly' ? ' active' : '') + '" onclick="switchModulePeriod(\'monthly\')">\u6708\u5ea6</button>' +
            '<button class="toggle-btn' + (appState.modulePeriod === 'weekly' ? ' active' : '') + '" onclick="switchModulePeriod(\'weekly\')">\u5468\u5ea6</button>' +
          '</div>' +
        '</div>' +
        '<div class="chart-section">' +
          '<div id="charts_' + activeModule + '_monthly" class="view-container"' + monthlyDisplay + '></div>' +
          '<div id="charts_' + activeModule + '_weekly" class="view-container"' + weeklyDisplay + '></div>' +
        '</div>' +
      '</div>' +
    '</section>';

  if (!_structureState[activeModule]) {
    _structureState[activeModule] = { open: false, dept: '\u5168\u90e8', view: appState.modulePeriod };
  }
  _structureState[activeModule].view = appState.modulePeriod;
  if (!_efficiencyAnalysisState[activeModule]) {
    _efficiencyAnalysisState[activeModule] = { open: false, dept: '\u5168\u90e8', view: appState.modulePeriod };
  }
  _efficiencyAnalysisState[activeModule].view = appState.modulePeriod;
  renderModule(activeModule, appState.modulePeriod, activeIdx);
}

function renderEfficiencyAnalysis(moduleName, view) {
  const state = _efficiencyAnalysisState[moduleName];
  if (!state) return;
  const sid = moduleName + '_' + view;
  const analysisData = EFFICIENCY_ANALYSIS_DATA[view] && EFFICIENCY_ANALYSIS_DATA[view][moduleName] && EFFICIENCY_ANALYSIS_DATA[view][moduleName][state.dept];
  const titleEl = document.getElementById('efficiency_title_' + sid);
  const contentEl = document.getElementById('efficiency_content_' + sid);

  if (titleEl) {
    titleEl.innerHTML = '<span>当前分析</span><strong>' + getOverviewDisplayNameV3(moduleName) + ' · ' + state.dept + ' · ' + getPeriodText(view) + '</strong>';
  }
  if (!contentEl) return;
  if (!analysisData) {
    contentEl.innerHTML = '<div class="efficiency-placeholder"><div class="efficiency-placeholder-title">暂无数据</div><div class="efficiency-placeholder-text">当前筛选条件下还没有可展示的效率分析数据。</div></div>';
    return;
  }

  const deptRows = analysisData.demand_dept_times.length
    ? analysisData.demand_dept_times.map(item =>
        '<tr>' +
          '<td>' + item.label + '</td>' +
          '<td class="num">' + formatSingleTimeText(item.single_time) + '</td>' +
          '<td class="num">' + formatOutputText(item.output) + '</td>' +
          '<td class="num">' + item.output_share.toFixed(1) + '%</td>' +
        '</tr>'
      ).join('')
    : '<tr><td colspan="4" class="efficiency-empty-cell">暂无数据</td></tr>';

  const overallDiff = (analysisData.overall_curr_single_time || 0) - (analysisData.overall_prev_single_time || 0);
  const impactDirection = overallDiff < 0 ? 'down' : 'up';
  const impactTitlePrefix = impactDirection === 'down' ? '拉低' : '拉高';
  const deptImpactSource = impactDirection === 'down' ? (analysisData.top_dept_impact_down || []) : (analysisData.top_dept_impact_up || []);
  const projectImpactSource = impactDirection === 'down' ? (analysisData.top_project_impact_down || []) : (analysisData.top_project_impact_up || []);

  function buildImpactRow(label, prevSingleTime, currSingleTime, prevOutput, currOutput, impactMinutes) {
    const impactText = (impactMinutes > 0 ? '+' : '') + formatOutputText(impactMinutes) + ' min';
    return '<div class="efficiency-impact-row">' +
      '<div class="efficiency-rank-project" title="' + label + '">' + label + '</div>' +
      '<div class="efficiency-fluctuation-metrics">' +
        '<span>' + formatSingleTimeText(prevSingleTime) + ' → ' + formatSingleTimeText(currSingleTime) + '</span>' +
        '<span>产出 ' + formatOutputText(prevOutput) + ' → ' + formatOutputText(currOutput) + '</span>' +
        '<span class="efficiency-diff ' + impactDirection + '">工时影响 ' + impactText + '</span>' +
      '</div>' +
    '</div>';
  }

  const deptImpactRows = deptImpactSource.length
    ? deptImpactSource.map(item =>
        buildImpactRow(
          item.label,
          item.prev_single_time,
          item.curr_single_time,
          item.prev_output,
          item.curr_output,
          item.impact_minutes
        )
      ).join('')
    : '<div class="volatility-empty">暂无数据</div>';

  const projectImpactRows = projectImpactSource.length
    ? projectImpactSource.map(item =>
        buildImpactRow(
          item.project,
          item.prev_single_time,
          item.curr_single_time,
          item.prev_output,
          item.curr_output,
          item.impact_minutes
        )
      ).join('')
    : '<div class="volatility-empty">暂无数据</div>';

  contentEl.innerHTML =
    '<div class="efficiency-analysis-layout efficiency-analysis-layout-v2">' +
      '<section class="efficiency-panel">' +
        '<div class="efficiency-panel-title">当期需求部门素材耗时</div>' +
        '<table class="efficiency-table">' +
          '<thead><tr><th>需求部门</th><th>单素材耗时</th><th>产出数</th><th>产量占比</th></tr></thead>' +
          '<tbody>' + deptRows + '</tbody>' +
        '</table>' +
      '</section>' +
      '<section class="efficiency-panel">' +
        '<div class="efficiency-subpanel">' +
          '<div class="efficiency-subpanel-title">' + impactTitlePrefix + '工时影响 TOP3 部门</div>' +
          '<div class="efficiency-fluctuation-list">' + deptImpactRows + '</div>' +
        '</div>' +
        '<div class="efficiency-subpanel efficiency-subpanel-spaced">' +
          '<div class="efficiency-subpanel-title">' + impactTitlePrefix + '工时影响 TOP3 项目</div>' +
          '<div class="efficiency-fluctuation-list">' + projectImpactRows + '</div>' +
        '</div>' +
      '</section>' +
    '</div>';
}
renderApp();
