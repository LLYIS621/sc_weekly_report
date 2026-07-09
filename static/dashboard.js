const DATA = window.DASHBOARD_PAYLOAD.DATA;
const LABOR_COST_DATA = window.DASHBOARD_PAYLOAD.LABOR_COST_DATA || {};
const ANOMALY_REASON_DATA = window.DASHBOARD_PAYLOAD.ANOMALY_REASON_DATA || {monthly: {}, weekly: {}};
const STRUCTURE_DATA = window.DASHBOARD_PAYLOAD.STRUCTURE_DATA;
const EFFICIENCY_ANALYSIS_DATA = window.DASHBOARD_PAYLOAD.EFFICIENCY_ANALYSIS_DATA;
const PERSON_EFFICIENCY_DATA = window.DASHBOARD_PAYLOAD.PERSON_EFFICIENCY_DATA || {};
const MONTH_LABELS = window.DASHBOARD_PAYLOAD.MONTH_LABELS;
const LABOR_COST_MONTH_LABELS = window.DASHBOARD_PAYLOAD.LABOR_COST_MONTH_LABELS || [];
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
const CONTENT_EDITING_MODULE = '内容团队-剪辑';
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

function getSettledLaborCostMonths() {
  return LABOR_COST_MONTH_LABELS.filter(month => LABOR_COST_MODULES.some(moduleName => {
    const moduleData = LABOR_COST_DATA[moduleName];
    const metrics = moduleData && moduleData.total_metrics ? moduleData.total_metrics[month] : null;
    return metrics && Number(metrics.single_labor_cost) > 0;
  }));
}

function getLaborCostDisplayContext(moduleName) {
  const data = LABOR_COST_DATA[moduleName];
  if (!data) return null;
  const labels = getSettledLaborCostMonths().filter(month => {
    const metrics = data.total_metrics[month];
    return metrics && Number(metrics.single_labor_cost) > 0;
  });
  if (!labels.length) return null;
  return { data, labels, latestMonth: labels[labels.length - 1] };
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

function getAnomalyViewData(moduleName, view) {
  return ANOMALY_REASON_DATA[view] && ANOMALY_REASON_DATA[view][moduleName]
    ? ANOMALY_REASON_DATA[view][moduleName]
    : null;
}

function getAnomalyReasonText(moduleName, view, metricKey, dept) {
  const item = getAnomalyReasonItem(moduleName, view, metricKey, dept);
  return item.text || '';
}

function getAnomalyReasonItem(moduleName, view, metricKey, dept) {
  const viewData = getAnomalyViewData(moduleName, view);
  const metricData = viewData && viewData[metricKey];
  const item = metricData && metricData[dept];
  if (!item) return {headline: '', detail: '', text: ''};
  const headline = item.headline || '';
  const detail = item.detail || '';
  const text = item.text || (headline && detail ? headline + '<br>' + detail : headline || detail);
  return {headline, detail, text};
}

function extractCommonCauseFragments(text) {
  const fragments = [];
  const patterns = [
    /工作日(?:减少|增加)<span class="anomaly-delta (?:down|up)">[^<]+<\/span>/g,
    /产出用人力(?:减少|增加)<span class="anomaly-delta (?:down|up)">[^<]+<\/span>/g
  ];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => {
      if (fragments.indexOf(match) < 0) fragments.push(match);
    });
  });
  return fragments;
}

function removeCommonCauseFragments(text, fragments) {
  let result = text;
  fragments.forEach(fragment => {
    result = result.replace('、' + fragment, '');
    result = result.replace(fragment + '、', '');
    result = result.replace(fragment, '');
  });
  result = result.replace(/主要因\s*。/g, '。');
  result = result.replace(/，\s*。/g, '。');
  result = result.replace(/、\s*。/g, '。');
  result = result.replace(/，主要因(?=<br>|$)/g, '');
  return result;
}

function normalizeManpowerCauseFragment(fragment) {
  const match = fragment.match(/^(产出用人力(?:减少|增加))<span class="anomaly-delta (down|up)">([^<]+)人<\/span>$/);
  if (!match) return fragment;
  const value = Math.abs(parseFloat(match[3]));
  if (!Number.isFinite(value) || value < 0.5) return '';
  return match[1] + '<span class="anomaly-delta ' + match[2] + '">' + value.toFixed(2) + '人</span>';
}

function normalizeCauseFragments(fragments) {
  return fragments.map(fragment => {
    return fragment.indexOf('产出用人力') === 0 ? normalizeManpowerCauseFragment(fragment) : fragment;
  }).filter(Boolean);
}

function buildAvgDailyCommonText(reasonPairs, commonFragments) {
  const workdayFragment = commonFragments.find(fragment => fragment.indexOf('工作日') === 0);
  if (!workdayFragment) {
    const normalizedFragments = normalizeCauseFragments(commonFragments);
    return normalizedFragments.length ? '各部门均受' + normalizedFragments.join('、') + '影响。' : '';
  }
  return '因' + workdayFragment + '，人均日均产出与总产出的变动幅度出现差异。';
}

function getAnomalyReasonBreakdown(moduleName, view, metricKey, lineItems) {
  const deptItems = lineItems.filter(item => !item.isTotal);
  const empty = {commonText: '', deptReasons: {}};
  if (deptItems.length <= 1) return empty;
  const reasonPairs = deptItems.map(item => ({
    name: item.name,
    reason: getAnomalyReasonItem(moduleName, view, metricKey, item.name)
  }));
  if (reasonPairs.some(pair => !pair.reason.text)) return empty;
  const firstKey = [reasonPairs[0].reason.headline || '', reasonPairs[0].reason.detail || '', reasonPairs[0].reason.text || ''].join('|');
  const isSameReason = reasonPairs.every(pair => [pair.reason.headline || '', pair.reason.detail || '', pair.reason.text || ''].join('|') === firstKey);
  if (isSameReason) {
    const deptReasons = {};
    deptItems.forEach(item => { deptReasons[item.name] = {headline: '', detail: '', text: ''}; });
    if (metricKey === 'avg_daily_output' || metricKey === 'handoff_avg_daily_output') {
      const sameFragments = extractCommonCauseFragments(reasonPairs[0].reason.text);
      const commonText = buildAvgDailyCommonText(reasonPairs, sameFragments);
      if (commonText) return {commonText, deptReasons};
    }
    return {commonText: reasonPairs[0].reason.text, deptReasons};
  }

  if (metricKey !== 'avg_daily_output' && metricKey !== 'handoff_avg_daily_output') return empty;
  const commonFragments = extractCommonCauseFragments(reasonPairs[0].reason.text)
    .filter(fragment => reasonPairs.every(pair => pair.reason.text.indexOf(fragment) >= 0));
  if (!commonFragments.length) return empty;
  const deptReasons = {};
  reasonPairs.forEach(pair => {
    const text = removeCommonCauseFragments(pair.reason.text, commonFragments);
    const extraFragments = normalizeCauseFragments(extractCommonCauseFragments(text));
    deptReasons[pair.name] = {headline: '', detail: '', text: extraFragments.length ? '同时受' + extraFragments.join('、') + '影响。' : ''};
  });
  return {
    commonText: buildAvgDailyCommonText(reasonPairs, commonFragments),
    deptReasons
  };
}

function renderAnomalyTotalCell(rangeLabel) {
  return '<div class="anomaly-brief-cell is-total-empty">' +
    '<div class="anomaly-brief-side-title">波动分析</div>' +
    (rangeLabel ? '<div class="anomaly-brief-range">' + escapeHtml(rangeLabel) + '</div>' : '') +
  '</div>';
}

function buildAnomalyBriefRow(moduleName, view, metricKey, data, lineItems, hasSummarySpacer) {
  if (!appState.anomalyBriefVisible) return '';
  const depts = data.depts || [];
  const hasReason = depts.some(dept => getAnomalyReasonText(moduleName, view, metricKey, dept));
  if (!hasReason) return '';
  const viewData = getAnomalyViewData(moduleName, view);
  const meta = metricKey === 'single_labor_cost' && viewData && viewData.labor_cost_meta ? viewData.labor_cost_meta : (viewData && viewData.meta);
  const rangeLabel = meta && meta.label ? meta.label : '';
  const hasTotalItem = lineItems.some(item => item.isTotal);
  const topNote = hasTotalItem ? '' : '<div class="anomaly-brief-top-note">' +
    '<span class="anomaly-brief-side-title">波动分析</span>' +
    (rangeLabel ? '<span class="anomaly-brief-range">' + escapeHtml(rangeLabel) + '</span>' : '') +
  '</div>';
  const commonBreakdown = getAnomalyReasonBreakdown(moduleName, view, metricKey, lineItems);
  const hasCommonReason = Boolean(commonBreakdown.commonText);
  const deptItems = lineItems.filter(item => !item.isTotal);
  const renderDeptCells = (reasonMap, rowIndex, firstDeptColumn) => deptItems.map((item, idx) => {
    const reason = reasonMap ? reasonMap[item.name] || {headline: '', detail: '', text: ''} : getAnomalyReasonItem(moduleName, view, metricKey, item.name);
    const gridStyle = rowIndex ? ' style="grid-column:' + (firstDeptColumn + idx) + ';grid-row:' + rowIndex + ';"' : '';
    const firstDeptClass = firstDeptColumn === 1 && idx === 0 ? ' is-first-dept' : '';
    return '<div class="anomaly-brief-cell' + firstDeptClass + (reason.text ? '' : ' is-empty') + '"' + gridStyle + '>' +
      (reason.text ? '<div class="anomaly-brief-dept-line"><div class="anomaly-brief-dept">' + escapeHtml(item.name) + '</div>' +
        (reason.headline ? '<div class="anomaly-brief-headline">' + reason.headline + '</div>' : '') +
        '</div><div class="anomaly-brief-text">' + (reason.detail || reason.text) + '</div>' : '') +
    '</div>';
  }).join('');
  const firstDeptColumn = hasTotalItem ? 2 : 1;
  const deptSpecificCells = hasCommonReason ? renderDeptCells(commonBreakdown.deptReasons, 2, firstDeptColumn) : '';
  const hasDeptSpecificReason = hasCommonReason && Object.keys(commonBreakdown.deptReasons).some(dept => commonBreakdown.deptReasons[dept].text);
  const deptCount = deptItems.length || 1;
  const totalCell = hasTotalItem
    ? '<div class="anomaly-brief-cell is-total-empty" style="grid-column:1;grid-row:1 / span ' + (hasDeptSpecificReason ? 2 : 1) + ';">' +
        '<div class="anomaly-brief-side-title">波动分析</div>' +
        (rangeLabel ? '<div class="anomaly-brief-range">' + escapeHtml(rangeLabel) + '</div>' : '') +
      '</div>'
    : '';
  const commonCells = hasCommonReason ? (
    totalCell +
    '<div class="anomaly-brief-common-row' + (hasTotalItem ? ' has-leading-divider' : '') + (hasDeptSpecificReason ? ' has-dept-specific' : '') + '"' +
      ' style="grid-column:' + firstDeptColumn + ' / span ' + deptCount + ';grid-row:1;">' +
      '<span class="anomaly-brief-common-label">各部门共性</span>' +
      '<span class="anomaly-brief-text">' + commonBreakdown.commonText + '</span>' +
    '</div>' +
    (hasDeptSpecificReason ? deptSpecificCells : '')
  ) : '';
  const cells = hasCommonReason ? commonCells : lineItems.map(item => {
    if (item.isTotal) {
      return renderAnomalyTotalCell(rangeLabel);
    }
    const reason = getAnomalyReasonItem(moduleName, view, metricKey, item.name);
    return '<div class="anomaly-brief-cell' + (reason.text ? '' : ' is-empty') + '">' +
      (reason.text ? '<div class="anomaly-brief-dept-line"><div class="anomaly-brief-dept">' + escapeHtml(item.name) + '</div>' +
        (reason.headline ? '<div class="anomaly-brief-headline">' + reason.headline + '</div>' : '') +
        '</div><div class="anomaly-brief-text">' + (reason.detail || reason.text) + '</div>' : '') +
    '</div>';
  }).join('');
  return '<div class="metric-row anomaly-brief-row">' +
    (hasSummarySpacer ? '<div class="metric-summary anomaly-brief-summary-spacer"></div>' : '') +
    '<div class="charts-row anomaly-brief-grid">' +
      '<div class="anomaly-brief-band">' +
        topNote +
        '<div class="anomaly-brief-cells' + (hasCommonReason ? ' has-common' : '') + '" style="grid-template-columns:repeat(' + lineItems.length + ', minmax(180px, 1fr));">' + cells + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
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
    outputGroup.insertAdjacentHTML('beforeend', buildAnomalyBriefRow(moduleName, view, m.key, data, lineItems, Boolean(summary)));
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
      effGroup.insertAdjacentHTML('beforeend', buildAnomalyBriefRow(moduleName, view, m.key, data, lineItems, Boolean(summary)));
    }

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

  // --- 单素材人力成本区块（月度结算口径，月度/周度页均展示） ---
  const laborCostView = LABOR_COST_MODULES.indexOf(moduleName) !== -1
    ? getLaborCostDisplayContext(moduleName)
    : null;
  if (laborCostView) {
    const lcm = LABOR_COST_METRIC;
    const lcmUnit = LABOR_COST_UNIT[moduleName] || '元';
    const lcmLabel = lcm.label + ' <span class="summary-unit">' + lcmUnit + '</span>';
    const lcData = laborCostView.data;
    const lcLabels = laborCostView.labels;
    const lcDeptNames = lcData.depts;
    const lcLineItems = [];
    if (lcData.show_total !== false) {
      lcLineItems.push({name: '总计', metrics: lcData.total_metrics, color: TOTAL_COLOR, isTotal: true});
    }
    lcDeptNames.forEach((dept, di) => {
      lcLineItems.push({name: dept, metrics: lcData.dept_metrics[dept],
                        color: DEPT_COLORS[di % DEPT_COLORS.length], isTotal: false});
    });

    const lcGroup = document.createElement('div');
    lcGroup.className = 'metric-group';
    lcGroup.innerHTML =
      '<div class="group-header">' +
      '<div class="group-title-wrap">' +
      '<div class="group-icon" style="background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#fff">&#128176;</div>' +
      '<span class="group-label">成本指标</span>' +
      '<span class="group-desc"> — 单素材人力成本（月度结算）</span>' +
      '</div>' +
      '<span class="cost-period-note">最新成本月 ' + laborCostView.latestMonth + '</span>' +
      '</div>';

    const lcRow = document.createElement('div');
    lcRow.className = 'metric-row';

    // 左侧KPI摘要
    const lcSummary = document.createElement('div');
    lcSummary.className = 'metric-summary cost';
    lcSummary.style.background = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
    lcSummary.style.borderColor = '#fcd34d';

    const lcTotalVals = lcLabels.map(l => lcData.total_metrics[l] ? (lcData.total_metrics[l][lcm.key] || 0) : 0);
    const lcTotalCh = calcChange(lcTotalVals);

    let lcSumHTML =
      '<div class="summary-metric-name" style="border-left-color:#f59e0b">' + lcmLabel + '</div>' +
      '<div class="summary-latest num" style="color:#92400e">' + fmtVal(lcTotalVals[lcTotalVals.length - 1], lcm.key) + '</div>';
    if (lcTotalCh) {
      lcSumHTML += '<div class="summary-trend ' + (lcTotalCh.dir === 'up' ? 'up' : 'down') + '">' +
        (lcTotalCh.dir === 'up' ? '&#9650;' : '&#9660;') + ' ' + Math.abs(lcTotalCh.pct) + '% 环比</div>';
    }
    lcSumHTML += '<div class="summary-depts">';
    lcDeptNames.forEach((d, i) => {
      const vals = lcLabels.map(l => lcData.dept_metrics[d][l] ? (lcData.dept_metrics[d][l][lcm.key] || 0) : 0);
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
    lcLineItems.forEach(item => {
      lcLabels.forEach(l => {
        const v = item.metrics[l];
        if (v && v[lcm.key] !== undefined) lcSharedMax = Math.max(lcSharedMax, v[lcm.key]);
      });
    });
    // 均值线（用总计的均值）— 原：动态计算
    if (lcData.total_metrics) {
      const lcValidVals = lcTotalVals.filter(v => v > 0);
      // 原：if (lcValidVals.length > 0) lcAvgLine = lcValidVals.reduce((a,b)=>a+b,0) / lcValidVals.length;
      if (lcValidVals.length > 0) lcAvgLine = lcValidVals.reduce((a,b)=>a+b,0) / lcValidVals.length;
    }
    // 不显示单素材人力成本均值线
    lcAvgLine = null;
    lcSharedMax = lcSharedMax * 1.25 || 1;

    lcLineItems.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'chart-card' + (item.isTotal ? ' is-total' : '');
      if (lcData.show_total !== false && idx === 1) {
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

      createLineChart(canvasId, canvas.getContext('2d'), item, lcm, lcLabels, lcSharedMax, lcAvgLine, lcData.show_total !== false, moduleName);
    });

    lcRow.appendChild(lcSummary);
    lcRow.appendChild(lcChartsRow);
    lcGroup.appendChild(lcRow);
    lcGroup.insertAdjacentHTML('beforeend', buildAnomalyBriefRow(moduleName, view, lcm.key, lcData, lcLineItems, true));
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
  anomalyBriefVisible: true,
  businessTab: 'roi',
  scriptOutputMode: 'write',
  personPeriod: '总体',
  personBusinessUnit: '总计',
  personDept: '全部',
  personClass: '全部',
  projectBusinessUnit: '全部',
  projectDemandType: '全部',
  projectDept: '全部',
  projectClass: '全部',
  projectShowLowDemand: false,
  personExpandedKey: '',
  personProjectDetailExpandedKey: '',
  personProjectExpanded: 0,
};
const MODULE_NOTE_STORAGE_KEY = 'creative-weekly-dashboard-module-notes';
const LONG_IMAGE_SELECTION_STORAGE_KEY = 'creative-weekly-dashboard-long-image-pages';
const LONG_IMAGE_MAX_DIMENSION = 30000;
const LONG_IMAGE_CAPTURE_SCALE = 3;
const standaloneCharts = {};

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    .concat([{ key: 'business', label: '\u6295\u5165\u4ea7\u51fa' }, { key: 'person', label: '\u4eba\u5458\u6548\u7387' }]);
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
  if (pageKey === 'person') return '\u4eba\u5458\u6548\u7387';
  const moduleName = pageKey.replace('module:', '');
  return getOverviewDisplayNameV3(moduleName) + '\u8be6\u60c5 | ' + getPeriodText(appState.modulePeriod);
}

function renderLongImagePage(pageKey) {
  if (pageKey === 'overview') {
    appState.mainView = 'overview';
  } else if (pageKey === 'business') {
    appState.mainView = 'business';
  } else if (pageKey === 'person') {
    appState.mainView = 'person';
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
  appState.personPeriod = savedState.personPeriod || appState.personPeriod;
  appState.personBusinessUnit = savedState.personBusinessUnit || appState.personBusinessUnit;
  appState.personDept = savedState.personDept || appState.personDept;
  appState.personClass = savedState.personClass || appState.personClass;
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
    businessTab: appState.businessTab,
    personPeriod: appState.personPeriod,
    personBusinessUnit: appState.personBusinessUnit,
    personDept: appState.personDept,
    personClass: appState.personClass
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
  const settledMonths = getSettledLaborCostMonths();
  const latestMonth = settledMonths[settledMonths.length - 1] || '';
  const cards = LABOR_COST_MODULES.map(moduleName => {
    const costView = getLaborCostDisplayContext(moduleName);
    const costMonth = costView ? costView.latestMonth : latestMonth;
    const value = costView && costView.data.total_metrics[costMonth] ? (costView.data.total_metrics[costMonth].single_labor_cost || 0) : 0;
    return '<div class="overview-card business-card">' +
      '<div class="overview-card-label">' + moduleName + '单素材人力成本</div>' +
      '<div class="overview-card-value num">' + fmtVal(value, 'single_labor_cost') + ' ' + LABOR_COST_UNIT[moduleName] + '</div>' +
      '<div class="overview-card-hint">最新成本月 ' + (costMonth || '-') + ' | 月度结算</div>' +
    '</div>';
  }).join('');

  container.innerHTML =
    '<div class="business-cost-page">' +
      '<div class="overview-kpis">' + cards + '</div>' +
      '<div class="overview-panel business-panel"><div class="overview-panel-title">已结算月单素材人力成本趋势</div><div class="overview-chart-box"><canvas id="laborCostTrendChart"></canvas></div></div>' +
    '</div>';

  const ctx = document.getElementById('laborCostTrendChart').getContext('2d');
  standaloneCharts.laborCostTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: settledMonths,
      datasets: LABOR_COST_MODULES.map((moduleName, idx) => ({
        label: moduleName,
        data: settledMonths.map(month => {
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
  } else if (appState.mainView === 'person') {
    renderPersonEfficiencyPage(viewRoot);
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

function toggleAnomalyBrief() {
  appState.anomalyBriefVisible = !appState.anomalyBriefVisible;
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

function setPersonPeriod(period) {
  appState.personPeriod = period;
  appState.personExpandedKey = '';
  appState.personProjectDetailExpandedKey = '';
  appState.projectBusinessUnit = '全部';
  appState.projectDemandType = '全部';
  appState.projectDept = '全部';
  appState.projectClass = '全部';
  renderApp();
}

function setPersonBusinessUnit(unit) {
  appState.personBusinessUnit = unit;
  appState.personExpandedKey = '';
  renderApp();
}

function setPersonDept(dept) {
  appState.personDept = dept;
  appState.personExpandedKey = '';
  renderApp();
}

function setPersonClass(className) {
  appState.personClass = className;
  appState.personExpandedKey = '';
  renderApp();
}

function setProjectBusinessUnit(unit) {
  appState.projectBusinessUnit = unit;
  appState.projectDemandType = '全部';
  appState.personProjectDetailExpandedKey = '';
  renderApp();
}

function setProjectDemandType(demandType) {
  appState.projectDemandType = demandType;
  appState.personProjectDetailExpandedKey = '';
  renderApp();
}

function setProjectDept(dept) {
  appState.projectDept = dept;
  appState.personProjectDetailExpandedKey = '';
  renderApp();
}

function setProjectClass(className) {
  appState.projectClass = className;
  appState.personProjectDetailExpandedKey = '';
  renderApp();
}

function togglePersonProjectLowDemand() {
  appState.projectShowLowDemand = !appState.projectShowLowDemand;
  appState.personProjectDetailExpandedKey = '';
  renderApp();
}

function resetPersonTableFilters() {
  appState.personBusinessUnit = '总计';
  appState.personDept = '全部';
  appState.personClass = '全部';
  appState.personExpandedKey = '';
  renderApp();
}

function resetPersonProjectFilters() {
  appState.projectBusinessUnit = '全部';
  appState.projectDemandType = '全部';
  appState.projectDept = '全部';
  appState.projectClass = '全部';
  appState.projectShowLowDemand = false;
  appState.personProjectDetailExpandedKey = '';
  renderApp();
}

function togglePersonExpanded(rowKey) {
  appState.personExpandedKey = appState.personExpandedKey === rowKey ? '' : rowKey;
  renderApp();
}

function togglePersonProjectDetail(rowKey) {
  appState.personProjectDetailExpandedKey = appState.personProjectDetailExpandedKey === rowKey ? '' : rowKey;
  renderApp();
}

function togglePersonProject(index) {
  appState.personProjectExpanded = appState.personProjectExpanded === index ? -1 : index;
  renderPersonProjectSection();
}

function formatPersonNumber(value, digits) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(digits === undefined ? 1 : digits);
}

function formatPersonPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return (Number(value) * 100).toFixed(0) + '%';
}

function formatPersonEfficiency(value) {
  return formatPersonNumber(value, 2);
}

function formatPersonTenure(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(1) + '年';
}

function formatPersonDays(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(0) + '天';
}

const PERSON_TEAM_LEADERS = new Set(['陈芳', '张哲', '张玲', '黎江江', '邓卓睿', '王帅']);

function formatPersonDisplayName(person) {
  const name = person || '';
  return name + (PERSON_TEAM_LEADERS.has(name) ? '（组长）' : '');
}

function getPersonPeriods() {
  const periods = PERSON_EFFICIENCY_DATA.periods || [];
  return periods.length ? periods : ['总体'];
}

function getPersonRows(period, unit, dept) {
  return (PERSON_EFFICIENCY_DATA.rows || []).filter(row =>
    row.period === period &&
    (!unit || row.businessUnit === unit) &&
    (!dept || dept === '全部' || row.dept === dept)
  );
}

function getPersonMainRows() {
  return getPersonRows(appState.personPeriod, appState.personBusinessUnit, appState.personDept)
    .filter(row => appState.personClass === '全部' || row.className === appState.personClass)
    .slice()
    .sort((a, b) => {
      const aBucket = a.isResigned ? 2 : (PERSON_TEAM_LEADERS.has(a.person) ? 1 : 0);
      const bBucket = b.isResigned ? 2 : (PERSON_TEAM_LEADERS.has(b.person) ? 1 : 0);
      if (aBucket !== bBucket) return aBucket - bBucket;
      return (b.efficiency || -999) - (a.efficiency || -999);
    });
}

function getPersonRowKey(row) {
  return [row.period, row.dept, row.person, row.businessUnit].map(encodeURIComponent).join('|');
}

function getPersonProjectDetailKey(row) {
  return [row.period, row.businessUnit, row.demandDept, row.product, row.demandType].map(encodeURIComponent).join('|');
}

function isSamePersonProjectDetail(row, target) {
  return row &&
    row.period === target.period &&
    row.businessUnit === target.businessUnit &&
    row.demandDept === target.demandDept &&
    row.product === target.product &&
    row.demandType === target.demandType;
}

function getPersonClassTone(className) {
  if (className === '高效率') return 'high';
  if (className === '正常') return 'normal';
  if (className === '待提升') return 'watch';
  return 'muted';
}

function classifyPersonEfficiency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '无标准';
  const numeric = Number(value);
  if (numeric >= 1.2) return '高效率';
  if (numeric >= 1.0) return '正常';
  return '待提升';
}

function buildPersonClassBadge(className) {
  return '<span class="person-class-badge tone-' + getPersonClassTone(className) + '">' + escapeHtml(className || '-') + '</span>';
}

function getPersonEfficiencyTone(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'muted';
  const numeric = Number(value);
  if (numeric >= 1.2) return 'high';
  if (numeric >= 1.0) return 'normal';
  return 'watch';
}

function buildPersonEfficiencyValue(value) {
  return '<span class="person-efficiency-value tone-' + getPersonEfficiencyTone(value) + '">' + formatPersonEfficiency(value) + '</span>';
}

function buildEmployeeStatusBadge(row) {
  const status = row.employeeStatus || (row.rosterMatched ? '-' : '未匹配');
  const tone = row.isResigned ? 'resigned' : (row.rosterMatched ? 'active' : 'unknown');
  return '<span class="person-employee-badge tone-' + tone + '">' + escapeHtml(status) + '</span>';
}

function getOverviewPersonRows() {
  return getPersonRows(appState.personPeriod, '总计', '全部');
}

function hasProjectStandard(row) {
  return (row.standardWorkload || 0) > 0 && (row.evaluatedOutput || 0) > 0;
}

function getProjectStandardRows() {
  return (PERSON_EFFICIENCY_DATA.projectDetails || [])
    .filter(row => row.period === appState.personPeriod && hasProjectStandard(row));
}

function getProjectBusinessUnits() {
  const preferredOrder = ['全部', '图片', '混剪', '实拍'];
  const values = getProjectStandardRows()
    .map(row => row.businessUnit)
    .filter(Boolean);
  const unique = Array.from(new Set(values));
  return preferredOrder
    .filter(unit => unit === '全部' || unique.includes(unit))
    .concat(unique.filter(unit => !preferredOrder.includes(unit)).sort((a, b) => a.localeCompare(b, 'zh-CN')));
}

function getEffectiveProjectBusinessUnit() {
  const businessUnits = getProjectBusinessUnits();
  return businessUnits.includes(appState.projectBusinessUnit) ? appState.projectBusinessUnit : '全部';
}

function getProjectDemandTypesForUnit(unit) {
  const values = getProjectStandardRows()
    .filter(row => unit === '全部' || row.businessUnit === unit)
    .map(row => row.demandType)
    .filter(Boolean);
  const unique = Array.from(new Set(values));
  const standardItems = ((PERSON_EFFICIENCY_DATA.standardCards || {})[unit] || [])
    .map(item => item && item.demandType)
    .filter(Boolean);
  const ordered = standardItems.filter(type => unique.includes(type));
  const remainder = unique
    .filter(type => !ordered.includes(type))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return ['全部'].concat(ordered, remainder);
}

function getEffectiveProjectDemandType(demandTypes) {
  const options = demandTypes || getProjectDemandTypesForUnit(getEffectiveProjectBusinessUnit());
  return options.includes(appState.projectDemandType) ? appState.projectDemandType : '全部';
}

function getPersonProjectBaseRows(includeDemandType) {
  const unit = getEffectiveProjectBusinessUnit();
  const demandTypes = getProjectDemandTypesForUnit(unit);
  const demandType = includeDemandType ? getEffectiveProjectDemandType(demandTypes) : '全部';
  return getProjectStandardRows()
    .filter(row =>
      (unit === '全部' || row.businessUnit === unit) &&
      (demandType === '全部' || row.demandType === demandType)
    );
}

function calcPersonWeightedEfficiency(standardWorkload, actualWorkload) {
  if (!actualWorkload || Number.isNaN(Number(actualWorkload))) return null;
  return Number(standardWorkload || 0) / Number(actualWorkload);
}

function getPersonAnalysisRows() {
  return getPersonRows(appState.personPeriod, '总计', '全部')
    .filter(row => row.eligible !== false && row.efficiency !== null && row.efficiency !== undefined);
}

function addPersonAnalysisMetric(target, row) {
  target.standardWorkload += row.standardWorkload || 0;
  target.evaluatedWorkload += row.evaluatedWorkload || 0;
  target.evaluatedOutput += row.evaluatedOutput || 0;
}

function finalizePersonAnalysisMetric(row) {
  row.efficiency = calcPersonWeightedEfficiency(row.standardWorkload, row.evaluatedWorkload);
  return row;
}

function getPersonAnalysisMonthlyEfficiency(rows, months) {
  const result = {};
  months.forEach(month => {
    let numerator = 0;
    let denominator = 0;
    rows.forEach(row => {
      const value = (row.monthlyEfficiency || {})[month];
      if (value === null || value === undefined || Number.isNaN(Number(value))) return;
      const weight = row.evaluatedOutput || 1;
      numerator += Number(value) * weight;
      denominator += weight;
    });
    result[month] = denominator ? numerator / denominator : null;
  });
  return result;
}

function buildPersonActionTypeItems() {
  const months = PERSON_EFFICIENCY_DATA.months || ['2026-03', '2026-04', '2026-05'];
  const groupMap = {};
  getProjectStandardRows().forEach(row => {
    const key = [row.dept || '-', row.businessUnit || '-', row.demandType || '-'].join('|');
    if (!groupMap[key]) {
      groupMap[key] = {
        dept: row.dept || '-',
        businessUnit: row.businessUnit || '-',
        demandType: row.demandType || '-',
        standardWorkload: 0,
        evaluatedWorkload: 0,
        evaluatedOutput: 0,
        rows: [],
      };
    }
    addPersonAnalysisMetric(groupMap[key], row);
    groupMap[key].rows.push(row);
  });
  const groups = Object.values(groupMap).map(row => {
    finalizePersonAnalysisMetric(row);
    row.monthlyEfficiency = getPersonAnalysisMonthlyEfficiency(row.rows, months);
    row.lowMonths = months.filter(month => {
      const value = row.monthlyEfficiency[month];
      return value !== null && value !== undefined && value < 1;
    }).length;
    row.allMonthsLow = months.every(month => {
      const value = row.monthlyEfficiency[month];
      return value !== null && value !== undefined && value < 1;
    });
    return row;
  });
  const byType = {};
  groups.forEach(row => {
    const key = [row.businessUnit, row.demandType].join('|');
    if (!byType[key]) byType[key] = [];
    byType[key].push(row);
  });
  Object.keys(byType).forEach(key => {
    byType[key]
      .sort((a, b) => (a.efficiency || 999) - (b.efficiency || 999))
      .forEach((row, idx) => { row.typeRank = idx + 1; row.typeDeptCount = byType[key].length; });
  });
  return groups
    .filter(row =>
      row.efficiency !== null &&
      row.efficiency < 1 &&
      row.allMonthsLow &&
      row.evaluatedOutput >= 50 &&
      row.typeDeptCount >= 2 &&
      row.typeRank <= 2
    )
    .sort((a, b) => {
      if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
      const outputDiff = (b.evaluatedOutput || 0) - (a.evaluatedOutput || 0);
      if (outputDiff !== 0) return outputDiff;
      return (a.efficiency || 999) - (b.efficiency || 999);
    })
    .slice(0, 6)
    .map(row => ({
      dept: row.dept,
      title: row.businessUnit + ' / ' + row.demandType,
      reason: '3个月均低于标准，同类型制作部门倒数第 ' + row.typeRank + '。',
      meta: '评估效率 ' + formatPersonEfficiency(row.efficiency),
    }));
}

function getProjectActionGroupKey(row, includeDemandType) {
  const parts = [row.demandDept || '-', row.product || '-'];
  if (includeDemandType) parts.push(row.demandType || '-');
  return parts.join('|');
}

function buildProjectActionGroups(includeDemandType) {
  const groupMap = {};
  getProjectStandardRows().forEach(row => {
    const projectKey = getProjectActionGroupKey(row, includeDemandType);
    const deptKey = projectKey + '|' + (row.dept || '-');
    if (!groupMap[projectKey]) {
      groupMap[projectKey] = {
        projectKey: projectKey,
        demandDept: row.demandDept || '-',
        product: row.product || '-',
        demandType: includeDemandType ? (row.demandType || '-') : '',
        deptRows: {},
      };
    }
    if (!groupMap[projectKey].deptRows[deptKey]) {
      groupMap[projectKey].deptRows[deptKey] = {
        dept: row.dept || '-',
        standardWorkload: 0,
        evaluatedWorkload: 0,
        evaluatedOutput: 0,
      };
    }
    addPersonAnalysisMetric(groupMap[projectKey].deptRows[deptKey], row);
  });
  return Object.values(groupMap).map(group => {
    group.depts = Object.values(group.deptRows).map(finalizePersonAnalysisMetric);
    return group;
  });
}

function getProjectActionCandidatesFromGroups(groups, level) {
  const candidates = [];
  groups.forEach(group => {
    if (group.depts.length < 2) return;
    group.depts.forEach(row => {
      if (!row.evaluatedOutput || row.evaluatedOutput < 20 || row.efficiency === null || row.efficiency >= 1) return;
      const others = group.depts.filter(item => item.dept !== row.dept);
      const otherStandard = others.reduce((sum, item) => sum + (item.standardWorkload || 0), 0);
      const otherActual = others.reduce((sum, item) => sum + (item.evaluatedWorkload || 0), 0);
      const otherEfficiency = calcPersonWeightedEfficiency(otherStandard, otherActual);
      const gap = otherEfficiency === null ? 0 : otherEfficiency - row.efficiency;
      if (otherEfficiency === null || gap < 0.1) return;
      candidates.push({
        dept: row.dept,
        level: level,
        demandDept: group.demandDept,
        product: group.product,
        demandType: group.demandType,
        efficiency: row.efficiency,
        otherEfficiency: otherEfficiency,
        gap: gap,
        evaluatedOutput: row.evaluatedOutput,
        projectKey: group.projectKey,
      });
    });
  });
  return candidates;
}

function buildPersonActionProjectItems() {
  const productGroups = buildProjectActionGroups(false);
  const typeGroups = buildProjectActionGroups(true);
  const typeCandidates = getProjectActionCandidatesFromGroups(typeGroups, '类型级');
  const productTypeMap = {};
  typeCandidates.forEach(item => {
    const key = [item.demandDept, item.product, item.dept].join('|');
    if (!productTypeMap[key]) productTypeMap[key] = [];
    productTypeMap[key].push(item);
  });
  const productCandidates = getProjectActionCandidatesFromGroups(productGroups, '产品级');
  const finalItems = [];
  productCandidates.forEach(item => {
    const key = [item.demandDept, item.product, item.dept].join('|');
    const typeItems = productTypeMap[key] || [];
    if (typeItems.length >= 2) {
      finalItems.push(Object.assign({}, item, {reasonTag: '整体落后'}));
    } else {
      typeItems.forEach(typeItem => finalItems.push(Object.assign({}, typeItem, {reasonTag: '类型落后'})));
    }
  });
  typeCandidates.forEach(item => {
    const key = [item.demandDept, item.product, item.dept].join('|');
    if (!productCandidates.some(candidate => [candidate.demandDept, candidate.product, candidate.dept].join('|') === key)) {
      finalItems.push(Object.assign({}, item, {reasonTag: '类型落后'}));
    }
  });
  const seen = new Set();
  return finalItems
    .filter(item => {
      const key = [item.dept, item.level, item.demandDept, item.product, item.demandType || ''].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const gapDiff = (b.gap || 0) - (a.gap || 0);
      if (gapDiff !== 0) return gapDiff;
      return (b.evaluatedOutput || 0) - (a.evaluatedOutput || 0);
    })
    .slice(0, 6)
    .map(item => {
      const title = item.level === '产品级'
        ? item.demandDept + ' / ' + item.product
        : item.demandDept + ' / ' + item.product + ' / ' + item.demandType;
      return {
        dept: item.dept,
        title: title,
        reason: item.reasonTag + '，低于其他制作部门 ' + formatPersonNumber(item.gap, 2) + '。',
        meta: '本部门 ' + formatPersonEfficiency(item.efficiency) + ' / 其他部门 ' + formatPersonEfficiency(item.otherEfficiency),
      };
    });
}

function buildPersonActionListHtml(items, emptyText) {
  if (!items.length) return '<div class="person-action-empty">' + escapeHtml(emptyText) + '</div>';
  return '<div class="person-action-list">' + items.map((item, idx) =>
    '<div class="person-action-item">' +
      '<div class="person-action-rank">' + (idx + 1) + '</div>' +
      '<div class="person-action-content">' +
        '<div class="person-action-title"><b>' + escapeHtml(item.dept) + '</b><span>' + escapeHtml(item.title) + '</span><em>' + escapeHtml(item.meta) + '</em></div>' +
        '<div class="person-action-reason">' + escapeHtml(item.reason) + '</div>' +
      '</div>' +
    '</div>'
  ).join('') + '</div>';
}

function buildPersonAnalysisHtml() {
  const typeItems = buildPersonActionTypeItems();
  const projectItems = buildPersonActionProjectItems();
  return '<section class="person-panel person-analysis-panel">' +
    '<div class="person-section-head"><div><div class="person-section-title">重点关注</div><div class="person-section-hint">基于当前统计范围，定位制作部门需要优先复盘的需求类型和项目</div></div></div>' +
    '<div class="person-action-grid">' +
      '<div class="person-action-block">' +
        '<div class="person-analysis-block-title">需求类型提升点</div>' +
        buildPersonActionListHtml(typeItems, '暂无满足“3个月均低效且同类型倒数前2”的需求类型。') +
      '</div>' +
      '<div class="person-action-block">' +
        '<div class="person-analysis-block-title">项目提升点</div>' +
        buildPersonActionListHtml(projectItems, '暂无满足“待提升且落后其他制作部门”的项目。') +
      '</div>' +
    '</div>' +
  '</section>';
}

function getPersonProjectGroups(includeDemandType) {
  const groupMap = {};
  getPersonProjectBaseRows(includeDemandType !== false).forEach(row => {
    const key = getPersonProjectDetailKey(row);
    if (!groupMap[key]) {
      groupMap[key] = {
        key: key,
        period: row.period,
        businessUnit: row.businessUnit,
        demandDept: row.demandDept,
        product: row.product,
        demandType: row.demandType,
        totalEvaluatedOutput: 0,
        rows: [],
      };
    }
    groupMap[key].totalEvaluatedOutput += row.evaluatedOutput || 0;
    groupMap[key].rows.push(row);
  });
  return Object.values(groupMap)
    .filter(group => appState.projectShowLowDemand || group.totalEvaluatedOutput >= 100)
    .map(group => {
      group.rows = group.rows.slice().sort((a, b) => {
        const outputDiff = (b.evaluatedOutput || 0) - (a.evaluatedOutput || 0);
        if (outputDiff !== 0) return outputDiff;
        return (b.efficiency || -999) - (a.efficiency || -999);
      });
      group.matchingRows = group.rows.filter(row => isProjectRowHighlighted(row));
      return group;
    })
    .filter(group => group.matchingRows.length > 0)
    .sort((a, b) => {
      const outputDiff = (b.totalEvaluatedOutput || 0) - (a.totalEvaluatedOutput || 0);
      if (outputDiff !== 0) return outputDiff;
      const aEfficiency = Math.max.apply(null, a.rows.map(row => row.efficiency || -999));
      const bEfficiency = Math.max.apply(null, b.rows.map(row => row.efficiency || -999));
      return bEfficiency - aEfficiency;
    });
}

function isProjectRowHighlighted(row) {
  const dept = getEffectiveProjectDept();
  const classNameFilter = getEffectiveProjectClass();
  const deptMatch = dept === '全部' || row.dept === dept;
  const className = classifyPersonEfficiency(row.efficiency);
  const classMatch = classNameFilter === '全部' || className === classNameFilter;
  return deptMatch && classMatch;
}

function getPersonProjectDemandTypes() {
  return getProjectDemandTypesForUnit(getEffectiveProjectBusinessUnit());
}

function getProjectDepartments() {
  const values = getPersonProjectBaseRows(true)
    .map(row => row.dept)
    .filter(Boolean);
  return ['全部'].concat(Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh-CN')));
}

function getEffectiveProjectDept(depts) {
  const options = depts || getProjectDepartments();
  return options.includes(appState.projectDept) ? appState.projectDept : '全部';
}

function getEffectiveProjectClass(classes) {
  const options = classes || ['全部'].concat(PERSON_EFFICIENCY_DATA.classNames || ['高效率', '正常', '待提升']);
  return options.includes(appState.projectClass) ? appState.projectClass : '全部';
}

function hasProjectSoftFilters() {
  return getEffectiveProjectDept() !== '全部' || getEffectiveProjectClass() !== '全部';
}

function buildFilterSummaryHtml(items, resetActionName) {
  const activeItems = items.filter(item => item && item.value);
  const body = activeItems.length
    ? activeItems.map(item =>
        '<span class="person-filter-summary-tag"><b>' + escapeHtml(item.label) + '</b>' + escapeHtml(item.value) + '</span>'
      ).join('')
    : '<span class="person-filter-summary-empty">无</span>';
  const resetButton = resetActionName
    ? '<button class="person-filter-summary-reset' + (activeItems.length ? ' active' : '') + '" type="button" onclick="' + resetActionName + '()">清空</button>'
    : '';
  return '<div class="person-filter-summary">' +
    '<span class="person-filter-summary-label">当前筛选</span>' +
    '<div class="person-filter-summary-tags">' + body + '</div>' +
    resetButton +
  '</div>';
}

function buildPersonProjectControlsHtml() {
  const businessUnits = getProjectBusinessUnits();
  const demandTypes = getPersonProjectDemandTypes();
  const depts = getProjectDepartments();
  const classes = ['全部'].concat(PERSON_EFFICIENCY_DATA.classNames || ['高效率', '正常', '待提升']);
  const activeUnit = getEffectiveProjectBusinessUnit();
  const activeDemandType = getEffectiveProjectDemandType(demandTypes);
  const activeDept = getEffectiveProjectDept(depts);
  const activeClass = getEffectiveProjectClass(classes);
  const typeGroupFiltered = activeUnit !== '全部' || activeDemandType !== '全部';
  const deptFiltered = activeDept !== '全部';
  const classFiltered = activeClass !== '全部';
  const rangeFiltered = appState.projectShowLowDemand;
  const demandTypeSelect = activeUnit === '全部' ? '' :
    '<label class="person-select-label person-demand-type-label' + (activeDemandType !== '全部' ? ' is-filtered' : '') + '">细分类型 ' +
      '<select class="person-select' + (activeDemandType !== '全部' ? ' is-filtered' : '') + '" onchange="setProjectDemandType(this.value)">' +
        demandTypes.map(type => '<option value="' + escapeHtmlAttr(type) + '"' + (activeDemandType === type ? ' selected' : '') + '>' + escapeHtml(type) + '</option>').join('') +
      '</select>' +
    '</label>';
  const summaryHtml = buildFilterSummaryHtml([
    {label: '素材类型：', value: activeUnit !== '全部' ? activeUnit : ''},
    {label: '细分类型：', value: activeUnit !== '全部' && activeDemandType !== '全部' ? activeDemandType : ''},
    {label: '制作部门：', value: activeDept !== '全部' ? activeDept : ''},
    {label: '效率分类：', value: activeClass !== '全部' ? activeClass : ''},
    {label: '项目范围：', value: appState.projectShowLowDemand ? '包含低需求项目' : ''},
  ], 'resetPersonProjectFilters');
  return '<div class="person-filter-bar">' +
    '<div class="person-filter-group' + (deptFiltered ? ' is-filtered' : '') + '"><label class="person-select-label' + (deptFiltered ? ' is-filtered' : '') + '">制作部门 ' +
      '<select class="person-select' + (deptFiltered ? ' is-filtered' : '') + '" onchange="setProjectDept(this.value)">' +
        depts.map(dept => '<option value="' + escapeHtmlAttr(dept) + '"' + (activeDept === dept ? ' selected' : '') + '>' + escapeHtml(dept) + '</option>').join('') +
      '</select>' +
    '</label></div>' +
    '<div class="person-filter-group person-project-type-filter' + (typeGroupFiltered ? ' is-filtered' : '') + '"><span class="person-filter-title">素材类型</span><div class="person-filter-type-stack">' +
      '<div class="person-filter-chips person-filter-secondary">' +
        businessUnits.map(unit =>
          '<button class="period-chip-btn' + (activeUnit === unit ? ' active' : '') + '" type="button" onclick="setProjectBusinessUnit(\'' + escapeHtmlAttr(unit) + '\')">' + escapeHtml(unit) + '</button>'
        ).join('') +
      '</div>' +
      demandTypeSelect +
    '</div></div>' +
    '<div class="person-filter-group' + (classFiltered ? ' is-filtered' : '') + '"><span class="person-filter-title">效率分类</span><div class="person-filter-chips">' +
      classes.map(className =>
        '<button class="period-chip-btn' + (activeClass === className ? ' active' : '') + '" type="button" onclick="setProjectClass(\'' + escapeHtmlAttr(className) + '\')">' + escapeHtml(className) + '</button>'
      ).join('') +
    '</div></div>' +
    '<div class="person-filter-group' + (rangeFiltered ? ' is-filtered' : '') + '"><span class="person-filter-title">项目范围</span><div class="person-filter-chips">' +
      '<button class="period-chip-btn' + (appState.projectShowLowDemand ? ' active' : '') + '" type="button" title="显示产出数<100的项目" aria-label="显示产出数小于100的项目" onclick="togglePersonProjectLowDemand()">显示低需求项目</button>' +
    '</div></div>' +
  '</div>' + summaryHtml;
}

function buildPersonLogicListHtml(value) {
  const values = Array.isArray(value) ? value : [value || ''];
  return '<ol class="person-logic-list">' + values.map(item => {
    if (item && typeof item === 'object') {
      const children = Array.isArray(item.children) ? item.children : [];
      const text = item.text || '';
      const highlightHtml = item.highlight
        ? '<span class="person-logic-highlight">' + escapeHtml(item.highlight) + '</span>'
        : '';
      const childrenHtml = children.length
        ? '<div class="person-logic-subtitle">' + escapeHtml(item.childrenTitle || '') + '</div>' +
          '<ul class="person-logic-sublist">' + children.map(child => '<li>' + escapeHtml(child) + '</li>').join('') + '</ul>'
        : '';
      return '<li><span class="person-logic-term">' + escapeHtml(item.title || '') + '</span>' +
        (text ? '：' : '') + escapeHtml(text) + highlightHtml + childrenHtml + '</li>';
    }
    return '<li>' + escapeHtml(item) + '</li>';
  }).join('') + '</ol>';
}

function buildPersonLogicHtml() {
  const readme = PERSON_EFFICIENCY_DATA.readme || {};
  const standardCards = PERSON_EFFICIENCY_DATA.standardCards || {};
  const standardGroups = [
    {title: '图片', items: standardCards['图片'] || []},
    {title: '剪辑', items: (standardCards['混剪'] || []).concat(standardCards['实拍'] || [])},
  ].filter(group => group.items.length);
  const fallbackStandards = Array.isArray(standardCards) ? standardCards : [];
  return '<section class="person-logic person-logic-redesign">' +
    '<div class="person-logic-head">' +
      '<div class="person-logic-heading">指标说明</div>' +
    '</div>' +
    '<div class="person-logic-body">' +
      '<div class="person-logic-grid">' +
        '<div class="person-logic-item person-logic-item-primary">' +
          buildPersonLogicListHtml(readme.metric || []) +
        '</div>' +
        '<div class="person-logic-item person-logic-item-standards">' +
          '<div class="person-standard-card-grid">' +
            (standardGroups.length ? standardGroups.map(group =>
              '<div class="person-standard-card">' +
                '<div class="person-standard-card-title">' + escapeHtml(group.title) + '</div>' +
                '<div class="person-standard-list">' +
                  group.items.map(item =>
                    '<div class="person-standard-row"><span>' + escapeHtml(item.demandType) + '</span><b class="num">' + formatPersonNumber(item.standardMinutes, 1) + '分钟</b></div>'
                  ).join('') +
                '</div>' +
              '</div>'
            ).join('') :
              '<div class="person-standard-card">' +
                '<div class="person-standard-list">' +
                  fallbackStandards.map(item =>
                    '<div class="person-standard-row"><span>' + escapeHtml(item.demandType) + '</span><b class="num">' + formatPersonNumber(item.standardMinutes, 1) + '分钟</b></div>'
                  ).join('') +
                '</div>' +
              '</div>'
            ) +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</section>';
}

function buildPersonKpiCardsHtml() {
  const rows = getOverviewPersonRows();
  const eligibleRows = rows.filter(row => row.eligible);
  const total = rows.length;
  const eligible = eligibleRows.length;
  const classCounts = {'高效率': 0, '正常': 0, '待提升': 0};
  eligibleRows.forEach(row => {
    if (classCounts[row.className] !== undefined) classCounts[row.className] += 1;
  });
  const cards = [
    {label: '总人数', value: total, ratio: total ? '100%' : '-', showRatio: false},
    {label: '纳入分析人数', value: eligible, ratio: total ? formatPersonPct(eligible / total) : '-', showRatio: false},
    {label: '高效率', value: classCounts['高效率'], ratio: eligible ? formatPersonPct(classCounts['高效率'] / eligible) : '-'},
    {label: '正常', value: classCounts['正常'], ratio: eligible ? formatPersonPct(classCounts['正常'] / eligible) : '-'},
    {label: '待提升', value: classCounts['待提升'], ratio: eligible ? formatPersonPct(classCounts['待提升'] / eligible) : '-'},
  ];
  return '<div class="person-kpi-grid">' + cards.map(card =>
    '<div class="person-kpi-card">' +
      '<div class="person-kpi-label">' + card.label + '</div>' +
      '<div class="person-kpi-value num">' + card.value + '</div>' +
      (card.showRatio === false ? '' : '<div class="person-kpi-ratio">占比 ' + card.ratio + '</div>') +
    '</div>'
  ).join('') + '</div>';
}

function getPersonDepartmentSummaryRows() {
  return (PERSON_EFFICIENCY_DATA.departmentSummary || [])
    .slice()
    .sort((a, b) => {
      const ae = a.efficiency === null || a.efficiency === undefined ? -999 : a.efficiency;
      const be = b.efficiency === null || b.efficiency === undefined ? -999 : b.efficiency;
      if (be !== ae) return be - ae;
      return (b.eligibleCount || 0) - (a.eligibleCount || 0);
    });
}

function buildDepartmentCountPill(value, tone) {
  return '<span class="person-count-pill tone-' + tone + '">' + escapeHtml(String(value || 0)) + '</span>';
}

function buildPersonDepartmentSummaryHtml() {
  const rows = getPersonDepartmentSummaryRows();
  if (!rows.length) return '<section class="person-panel"><div class="person-section-title">数据概览</div><div class="person-empty">当前暂无可展示的分部门情况。</div></section>';
  const legendItems = [
    {key: 'highCount', label: '高效率', tone: 'high'},
    {key: 'normalCount', label: '正常', tone: 'normal'},
    {key: 'watchCount', label: '待提升', tone: 'watch'},
  ];
  return '<section class="person-panel person-department-summary-panel">' +
    '<div class="person-section-head"><div><div class="person-section-title">数据概览</div></div></div>' +
    '<div class="person-overview-kpi-wrap">' + buildPersonKpiCardsHtml() + '</div>' +
    '<div class="person-dept-grid person-dept-grid-summary">' +
      rows.map((row, idx) => {
        const total = row.eligibleCount || 0;
        return '<div class="person-dept-card person-dept-card-summary">' +
          '<div class="person-dept-summary-top">' +
            '<div class="person-dept-summary-meta">' +
              '<div class="person-dept-name">' + escapeHtml(row.dept || '-') + '</div>' +
            '</div>' +
            '<div class="person-dept-summary-efficiency">' +
              '<span class="person-dept-summary-efficiency-label">评估效率</span>' +
              '<span class="person-dept-summary-efficiency-value num">' + formatPersonEfficiency(row.efficiency) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="person-dept-summary-breakdown">' +
            '<div class="person-dept-breakdown-title"><span>效率分类</span><em>人数占比</em></div>' +
            '<div class="person-pie-wrap person-pie-wrap-summary"><canvas id="personDeptSummaryPie_' + idx + '"></canvas><div class="person-pie-center"><span>' + escapeHtml(String(total)) + '</span><em>人</em></div></div>' +
            '<div class="person-dept-legend">' +
              legendItems.map(item => {
                const count = row[item.key] || 0;
                const ratio = total ? formatPersonPct(count / total) : '-';
                return '<div class="person-dept-legend-row">' +
                  '<span class="person-dept-legend-name"><i class="person-dept-legend-dot tone-' + item.tone + '"></i>' + item.label + '</span>' +
                  '<span class="person-dept-legend-metric"><b>' + escapeHtml(String(count)) + '人</b><em>' + escapeHtml(ratio) + '</em></span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</section>';
}

function getDepartmentPersonGroups() {
  const rows = getOverviewPersonRows().filter(row => row.eligible);
  const groups = {};
  rows.forEach(row => {
    if (!groups[row.dept]) {
      groups[row.dept] = {dept: row.dept, counts: {'高效率': 0, '正常': 0, '待提升': 0}, high: [], watch: []};
    }
    if (groups[row.dept].counts[row.className] !== undefined) groups[row.dept].counts[row.className] += 1;
    if (row.className === '高效率') groups[row.dept].high.push(row);
    if (row.className === '待提升') groups[row.dept].watch.push(row);
  });
  return Object.values(groups).sort((a, b) => a.dept.localeCompare(b.dept, 'zh-CN'));
}

function buildDeptPersonList(title, rows, className) {
  const sorted = rows.slice().sort((a, b) => className === 'watch'
    ? (a.efficiency || 999) - (b.efficiency || 999)
    : (b.efficiency || -999) - (a.efficiency || -999));
  if (!sorted.length) return '<div class="person-dept-list"><span class="person-dept-list-title">' + title + '</span><span class="person-empty-inline">暂无</span></div>';
  return '<div class="person-dept-list">' +
    '<span class="person-dept-list-title">' + title + '</span>' +
    sorted.map(row =>
      '<span class="person-mini-pill">' + escapeHtml(formatPersonDisplayName(row.person)) + ' <b>' + formatPersonEfficiency(row.efficiency) + '</b></span>'
    ).join('') +
  '</div>';
}

function buildPersonDepartmentDistributionHtml() {
  const groups = getDepartmentPersonGroups();
  if (!groups.length) return '<section class="person-panel"><div class="person-empty">当前统计范围暂无可展示的部门分类分布。</div></section>';
  return '<section class="person-panel">' +
    '<div class="person-section-head"><div><div class="person-section-title">部门分类分布</div><div class="person-section-subtitle">饼图仅受统计范围影响，下方列出各部门高效率和待提升人员。</div></div></div>' +
    '<div class="person-dept-grid">' +
      groups.map((group, idx) =>
        '<div class="person-dept-card">' +
          '<div class="person-dept-card-head">' +
            '<div class="person-dept-name">' + escapeHtml(group.dept) + '</div>' +
            '<div class="person-dept-total">纳入 ' + Object.values(group.counts).reduce((a, b) => a + b, 0) + ' 人</div>' +
          '</div>' +
          '<div class="person-pie-wrap"><canvas id="personDeptPie_' + idx + '"></canvas></div>' +
          buildDeptPersonList('高效率', group.high, 'high') +
          buildDeptPersonList('待提升', group.watch, 'watch') +
        '</div>'
      ).join('') +
    '</div>' +
  '</section>';
}

function renderPersonDepartmentCharts() {
  const groups = getPersonDepartmentSummaryRows().map(row => ({
    counts: {
      '高效率': row.highCount || 0,
      '正常': row.normalCount || 0,
      '待提升': row.watchCount || 0,
    }
  }));
  const labels = ['高效率', '正常', '待提升'];
  const colors = ['#6BAFA8', '#7E99C8', '#B98A55'];
  groups.forEach((group, idx) => {
    const canvas = document.getElementById('personDeptSummaryPie_' + idx);
    if (!canvas) return;
    const chartId = 'personDeptSummaryPie_' + appState.personPeriod + '_' + idx;
    const data = labels.map(label => group.counts[label] || 0);
    standaloneCharts[chartId] = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {labels, datasets: [{data, backgroundColor: colors, borderColor: '#fff', borderWidth: 2}]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {display: false},
          datalabels: {display: false}
        }
      }
    });
  });
}

function buildPersonTableControlsHtml() {
  const units = PERSON_EFFICIENCY_DATA.businessUnits || ['总计', '图片', '混剪'];
  const depts = ['全部'].concat(PERSON_EFFICIENCY_DATA.departments || []);
  const classes = ['全部'].concat(PERSON_EFFICIENCY_DATA.classNames || ['高效率', '正常', '待提升']);
  const unitFiltered = appState.personBusinessUnit !== '总计';
  const classFiltered = appState.personClass !== '全部';
  const deptFiltered = appState.personDept !== '全部';
  const summaryHtml = buildFilterSummaryHtml([
    {label: '素材类型：', value: appState.personBusinessUnit !== '总计' ? appState.personBusinessUnit : ''},
    {label: '效率分类：', value: appState.personClass !== '全部' ? appState.personClass : ''},
    {label: '制作部门：', value: appState.personDept !== '全部' ? appState.personDept : ''},
  ], 'resetPersonTableFilters');
  return '<div class="person-filter-bar">' +
    '<div class="person-filter-group' + (deptFiltered ? ' is-filtered' : '') + '"><label class="person-select-label' + (deptFiltered ? ' is-filtered' : '') + '">制作部门 ' +
      '<select class="person-select' + (deptFiltered ? ' is-filtered' : '') + '" onchange="setPersonDept(this.value)">' +
        depts.map(dept => '<option value="' + escapeHtmlAttr(dept) + '"' + (appState.personDept === dept ? ' selected' : '') + '>' + escapeHtml(dept) + '</option>').join('') +
      '</select>' +
    '</label></div>' +
    '<div class="person-filter-group' + (unitFiltered ? ' is-filtered' : '') + '"><span class="person-filter-title">素材类型</span><div class="person-filter-chips">' +
      units.map(unit =>
        '<button class="period-chip-btn' + (appState.personBusinessUnit === unit ? ' active' : '') + '" type="button" onclick="setPersonBusinessUnit(\'' + escapeHtmlAttr(unit) + '\')">' + escapeHtml(unit) + '</button>'
      ).join('') +
    '</div></div>' +
    '<div class="person-filter-group' + (classFiltered ? ' is-filtered' : '') + '"><span class="person-filter-title">效率分类</span><div class="person-filter-chips">' +
      classes.map(className =>
        '<button class="period-chip-btn' + (appState.personClass === className ? ' active' : '') + '" type="button" onclick="setPersonClass(\'' + escapeHtmlAttr(className) + '\')">' + escapeHtml(className) + '</button>'
      ).join('') +
    '</div></div>' +
  '</div>' + summaryHtml;
}

function buildPersonDetailRowsHtml(row) {
  const selectedUnit = appState.personBusinessUnit;
  const months = PERSON_EFFICIENCY_DATA.months || ['2026-03', '2026-04', '2026-05'];
  const monthHeaders = months.map(month => '<th>' + escapeHtml(month) + '</th>').join('');
  let details = (PERSON_EFFICIENCY_DATA.details || []).filter(item =>
    item.period === row.period &&
    item.dept === row.dept &&
    item.person === row.person &&
    (selectedUnit === '总计' || item.businessUnit === selectedUnit)
  );
  details = details.sort((a, b) => {
    const outputDiff = (b.evaluatedOutput || 0) - (a.evaluatedOutput || 0);
    if (outputDiff !== 0) return outputDiff;
    return (b.efficiency || -999) - (a.efficiency || -999);
  }).slice(0, 30);
  if (!details.length) return '<div class="person-empty">暂无可解释明细。</div>';
  const regularWidth = (100 / (6 + 1.5 + months.length)).toFixed(2);
  const productWidth = (regularWidth * 1.5).toFixed(2);
  const colGroup = '<colgroup>' +
    '<col style="width:' + regularWidth + '%">' +
    '<col style="width:' + productWidth + '%">' +
    Array.from({length: 5}).map(() => '<col style="width:' + regularWidth + '%">').join('') +
    months.map(() => '<col style="width:' + regularWidth + '%">').join('') +
  '</colgroup>';
  const tableHead = '<thead>' +
    '<tr>' +
      '<th rowspan="2">需求部门</th><th rowspan="2">产品名称</th><th rowspan="2">细分类型</th><th rowspan="2">评估效率</th>' +
      '<th rowspan="2"><span class="person-th-label">标准耗时</span><span class="person-th-unit">【小时】</span></th>' +
      '<th rowspan="2"><span class="person-th-label">实际耗时</span><span class="person-th-unit">【小时】</span></th><th rowspan="2">纳入评估产出数</th>' +
      '<th colspan="' + months.length + '">评估效率</th>' +
    '</tr>' +
    '<tr>' + monthHeaders + '</tr>' +
  '</thead>';
  return '<div class="person-detail-table-wrap">' +
    '<div class="person-inline-hint">按【产出数】降序</div>' +
    '<table class="person-detail-table">' +
      colGroup +
      tableHead +
      '<tbody>' + details.map(item =>
        '<tr>' +
          '<td>' + escapeHtml(item.demandDept || '-') + '</td>' +
          '<td>' + escapeHtml(item.product || '-') + '</td>' +
          '<td>' + escapeHtml(item.demandType || '-') + '</td>' +
          '<td class="num">' + buildPersonEfficiencyValue(item.efficiency) + '</td>' +
          '<td class="num">' + formatPersonNumber(item.standardWorkload, 1) + '</td>' +
          '<td class="num">' + formatPersonNumber(item.evaluatedWorkload, 1) + '</td>' +
          '<td class="num">' + formatPersonNumber(item.evaluatedOutput, 0) + '</td>' +
          months.map(month => '<td class="num">' + buildPersonEfficiencyValue((item.monthlyEfficiency || {})[month]) + '</td>').join('') +
        '</tr>'
      ).join('') + '</tbody>' +
    '</table>' +
  '</div>';
}

function buildPersonExpandedHtml(row, colSpan) {
  const rosterMeta = '入职时间：' + escapeHtml(row.joinDate || '-') +
    ' · 离职时间：' + escapeHtml(row.leaveDate || '-') +
    ' · 在职天数：' + escapeHtml(formatPersonDays(row.tenureDays));
  return '<tr class="person-expanded-row"><td colspan="' + colSpan + '">' +
    '<div class="person-expanded-panel">' +
      '<div class="person-expanded-head">' +
        '<div class="person-expanded-title-block">' +
          '<div class="person-expanded-title-line">' +
            '<div class="person-expanded-title">' + escapeHtml(formatPersonDisplayName(row.person)) + ' · 详情</div>' +
            '<div class="person-expanded-score">' + buildPersonClassBadge(row.className) + buildPersonEfficiencyValue(row.efficiency) + '</div>' +
          '</div>' +
        '<div class="person-expanded-subtitle">' + rosterMeta + '</div></div>' +
      '</div>' +
      '<div class="person-detail-block">' +
        '<div class="person-detail-title">任务/项目明细解释</div>' +
        buildPersonDetailRowsHtml(row) +
      '</div>' +
    '</div>' +
  '</td></tr>';
}

function buildPersonMainTableHtml() {
  const rows = getPersonMainRows();
  const months = PERSON_EFFICIENCY_DATA.months || ['2026-03', '2026-04', '2026-05'];
  const monthHeaders = months.map(month => '<th>' + escapeHtml(month) + '</th>').join('');
  const regularColumnCount = 9;
  const regularColumnWidth = (100 / (regularColumnCount + months.length * 0.72)).toFixed(2);
  const monthColumnWidth = (regularColumnWidth * 0.72).toFixed(2);
  const colGroup = '<colgroup>' +
    Array.from({length: 7}).map(() => '<col style="width:' + regularColumnWidth + '%">').join('') +
    months.map(() => '<col style="width:' + monthColumnWidth + '%">').join('') +
    Array.from({length: 2}).map(() => '<col style="width:' + regularColumnWidth + '%">').join('') +
  '</colgroup>';
  const tableHead = '<thead>' +
    '<tr>' +
      '<th rowspan="2">制作部门</th><th rowspan="2">制作人员</th><th rowspan="2">效率分类</th><th rowspan="2">评估效率</th>' +
      '<th rowspan="2"><span class="person-th-label">标准耗时</span><span class="person-th-unit">【小时】</span></th>' +
      '<th rowspan="2"><span class="person-th-label">实际耗时</span><span class="person-th-unit">【小时】</span></th><th rowspan="2">纳入评估产出数</th>' +
      '<th colspan="' + months.length + '">评估效率</th>' +
      '<th rowspan="2">员工状态</th><th rowspan="2">在职年数</th>' +
    '</tr>' +
    '<tr>' + monthHeaders + '</tr>' +
  '</thead>';
  const colSpan = 9 + months.length;
  const body = rows.length ? rows.map(row => {
    const key = getPersonRowKey(row);
    const expanded = appState.personExpandedKey === key;
    const dimmed = appState.personExpandedKey && !expanded;
    const basisCells = months.map(month => '<td class="num">' + buildPersonEfficiencyValue((row.monthlyEfficiency || {})[month]) + '</td>').join('');
    return '<tr class="person-main-row' + (expanded ? ' active' : '') + (dimmed ? ' dimmed' : '') + '">' +
        '<td>' + escapeHtml(row.dept) + '</td>' +
        '<td><button class="person-name-btn" type="button" onclick="togglePersonExpanded(\'' + key + '\')">' +
          '<span class="person-name-text">' + escapeHtml(formatPersonDisplayName(row.person)) + '</span>' +
          '<span class="person-link-cue" aria-hidden="true">›</span>' +
        '</button></td>' +
        '<td>' + buildPersonClassBadge(row.className) + '</td>' +
        '<td class="num">' + buildPersonEfficiencyValue(row.efficiency) + '</td>' +
        '<td class="num">' + formatPersonNumber(row.standardWorkload, 1) + '</td>' +
        '<td class="num">' + formatPersonNumber(row.evaluatedWorkload, 1) + '</td>' +
        '<td class="num">' + formatPersonNumber(row.evaluatedOutput, 0) + '</td>' +
        basisCells +
        '<td>' + buildEmployeeStatusBadge(row) + '</td>' +
        '<td class="num">' + formatPersonTenure(row.tenureYears) + '</td>' +
      '</tr>' +
      (expanded ? buildPersonExpandedHtml(row, colSpan) : '');
  }).join('') : '<tr><td colspan="' + colSpan + '" class="person-empty-cell">当前筛选下暂无人员数据。</td></tr>';

  return '<section class="person-panel person-table-panel">' +
    '<div class="person-section-head">' +
      '<div><div class="person-section-title">人员效率主表</div><div class="person-section-hint">按【评估效率】降序，点击【姓名】查看人员的项目详情</div></div>' +
    '</div>' +
    '<div class="person-table-filter-panel">' + buildPersonTableControlsHtml() + '</div>' +
    '<div class="person-table-scroll">' +
      '<table class="person-main-table">' +
        colGroup +
        tableHead +
        '<tbody>' + body + '</tbody>' +
      '</table>' +
    '</div>' +
  '</section>';
}

function getPersonProjectDetailDeptRows(project) {
  return (PERSON_EFFICIENCY_DATA.projectDetails || [])
    .filter(row => isSamePersonProjectDetail(row, project))
    .slice()
    .sort((a, b) => {
      const outputDiff = (b.evaluatedOutput || 0) - (a.evaluatedOutput || 0);
      if (outputDiff !== 0) return outputDiff;
      return (b.efficiency || -999) - (a.efficiency || -999);
    });
}

function getPersonProjectDetailPeopleRows(project) {
  return (PERSON_EFFICIENCY_DATA.details || [])
    .filter(row => isSamePersonProjectDetail(row, project))
    .slice()
    .sort((a, b) => {
      const efficiencyDiff = (b.efficiency || -999) - (a.efficiency || -999);
      if (efficiencyDiff !== 0) return efficiencyDiff;
      return (b.evaluatedOutput || 0) - (a.evaluatedOutput || 0);
    });
}

function buildPersonProjectDetailExpandedHtml(project, colSpan) {
  const months = PERSON_EFFICIENCY_DATA.months || ['2026-03', '2026-04', '2026-05'];
  const peopleRows = getPersonProjectDetailPeopleRows(project);
  const monthHead = months.map(month => '<th>' + escapeHtml(month) + '</th>').join('');
  const peopleBody = peopleRows.length ? peopleRows.map(row =>
    '<tr>' +
      '<td>' + escapeHtml(row.dept || '-') + '</td>' +
      '<td>' + escapeHtml(row.person || '-') + '</td>' +
      '<td>' + buildPersonClassBadge(classifyPersonEfficiency(row.efficiency)) + '</td>' +
      '<td class="num">' + buildPersonEfficiencyValue(row.efficiency) + '</td>' +
      '<td class="num">' + formatPersonNumber(row.evaluatedWorkload, 1) + '</td>' +
      '<td class="num">' + formatPersonNumber(row.standardWorkload, 1) + '</td>' +
      '<td class="num">' + formatPersonNumber(row.evaluatedOutput, 0) + '</td>' +
      months.map(month => '<td class="num">' + buildPersonEfficiencyValue((row.monthlyEfficiency || {})[month]) + '</td>').join('') +
    '</tr>'
  ).join('') : '<tr><td colspan="' + (7 + months.length) + '" class="person-empty-cell">暂无制作人员对比数据。</td></tr>';

  return '<tr class="person-project-detail-expanded-row"><td colspan="' + colSpan + '">' +
    '<div class="person-project-detail-expanded-panel">' +
      '<div class="person-project-detail-expanded-head">' +
        '<div class="person-project-detail-expanded-title">人员拆解</div>' +
        '<div class="person-project-detail-expanded-meta">' +
          '<span>需求部门：' + escapeHtml(project.demandDept || '-') + '</span>' +
          '<span>产品名称：' + escapeHtml(project.product || '-') + '</span>' +
          '<span>细分类型：' + escapeHtml(project.demandType || '-') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="person-project-detail-split">' +
        '<div class="person-project-detail-block">' +
          '<div class="person-inline-hint">按【评估效率】降序</div>' +
          '<div class="person-project-detail-table-wrap">' +
            '<table class="person-project-expanded-table">' +
              '<thead><tr><th rowspan="2">制作部门</th><th rowspan="2">制作人员</th><th rowspan="2">效率分类</th><th rowspan="2">评估效率</th><th rowspan="2"><span class="person-th-label">实际耗时</span><span class="person-th-unit">【小时】</span></th><th rowspan="2"><span class="person-th-label">标准耗时</span><span class="person-th-unit">【小时】</span></th><th rowspan="2">纳入评估产出数</th><th colspan="' + months.length + '">评估效率</th></tr><tr>' + monthHead + '</tr></thead>' +
              '<tbody>' + peopleBody + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</td></tr>';
}

function buildPersonProjectDetailTableHtml() {
  const groups = getPersonProjectGroups(true);
  const months = PERSON_EFFICIENCY_DATA.months || ['2026-03', '2026-04', '2026-05'];
  const monthHeaders = months.map(month => '<th>' + escapeHtml(month) + '</th>').join('');
  const baseWeight = 8 + 1.18 + months.length * 0.72;
  const projectRegularWidth = (100 / baseWeight).toFixed(2);
  const projectProductWidth = (projectRegularWidth * 1.18).toFixed(2);
  const projectMonthWidth = (projectRegularWidth * 0.72).toFixed(2);
  const colGroup = '<colgroup>' +
    '<col style="width:' + projectRegularWidth + '%">' +
    '<col style="width:' + projectProductWidth + '%">' +
    Array.from({length: 7}).map(() => '<col style="width:' + projectRegularWidth + '%">').join('') +
    months.map(() => '<col style="width:' + projectMonthWidth + '%">').join('') +
  '</colgroup>';
  const tableHead = '<thead>' +
    '<tr>' +
      '<th rowspan="2">需求部门</th><th rowspan="2">产品名称</th><th rowspan="2">细分类型</th><th rowspan="2">制作部门</th>' +
      '<th rowspan="2">效率分类</th><th rowspan="2">评估效率</th><th rowspan="2"><span class="person-th-label">单片耗时</span><span class="person-th-unit">【分钟】</span></th><th rowspan="2">单片收费</th><th rowspan="2">纳入评估产出数</th>' +
      '<th colspan="' + months.length + '">评估效率</th>' +
    '</tr>' +
    '<tr>' + monthHeaders + '</tr>' +
  '</thead>';
  const colSpan = 9 + months.length;
  const buildProjectCell = function(content, extraClass, dimmed) {
    return '<td' + (extraClass ? ' class="' + extraClass + '"' : '') + '><div class="person-project-cell-content' + (dimmed ? ' dimmed' : '') + '">' + content + '</div></td>';
  };
  const body = groups.length ? groups.map(group => {
    const expanded = appState.personProjectDetailExpandedKey === group.key;
    const rowspan = group.rows.length;
    const rowsHtml = group.rows.map((row, idx) => {
      const rowDimmed = ((appState.personProjectDetailExpandedKey && !expanded) || (hasProjectSoftFilters() && !isProjectRowHighlighted(row)));
      return '<tr class="person-project-detail-row person-project-group-row' + (idx === 0 ? ' group-start' : '') + (expanded ? ' active' : '') + (rowDimmed ? ' dimmed' : '') + '">' +
        (idx === 0
          ? '<td rowspan="' + rowspan + '" class="person-project-merged-cell">' + escapeHtml(group.demandDept || '-') + '</td>' +
            '<td rowspan="' + rowspan + '" class="person-project-merged-cell">' +
              '<button class="person-project-name-btn" type="button" onclick="togglePersonProjectDetail(\'' + escapeHtmlAttr(group.key) + '\')"><span class="person-name-text">' + escapeHtml(group.product || '-') + '</span><span class="person-link-cue" aria-hidden="true">›</span></button>' +
            '</td>' +
            '<td rowspan="' + rowspan + '" class="person-project-merged-cell">' + escapeHtml(group.demandType || '-') + '</td>'
          : '') +
        buildProjectCell(escapeHtml(row.dept || '-'), '', rowDimmed) +
        buildProjectCell(buildPersonClassBadge(classifyPersonEfficiency(row.efficiency)), '', rowDimmed) +
        buildProjectCell(buildPersonEfficiencyValue(row.efficiency), 'num', rowDimmed) +
        buildProjectCell(formatPersonNumber(row.singleTimeMinutes, 1), 'num', rowDimmed) +
        buildProjectCell(formatPersonNumber(row.unitFee, 2), 'num', rowDimmed) +
        buildProjectCell(formatPersonNumber(row.evaluatedOutput, 0), 'num', rowDimmed) +
        months.map(month => buildProjectCell(buildPersonEfficiencyValue((row.monthlyEfficiency || {})[month]), 'num', rowDimmed)).join('') +
      '</tr>';
    }).join('');
    return rowsHtml + (expanded ? buildPersonProjectDetailExpandedHtml(group.rows[0], colSpan) : '');
  }).join('') : '<tr><td colspan="' + colSpan + '" class="person-empty-cell">' +
    (appState.projectShowLowDemand
      ? '当前筛选下暂无项目明细。'
      : '当前筛选下暂无产出数≥100的项目，可开启“显示低需求项目”查看。') +
    '</td></tr>';

  return '<section class="person-panel">' +
    '<div class="person-section-head"><div><div class="person-section-title">项目明细表</div><div class="person-section-hint">按【产出数】降序，点击【产品名称】查看人员拆解</div></div></div>' +
    '<div class="person-table-filter-panel person-project-filter-panel">' + buildPersonProjectControlsHtml() + '</div>' +
    '<div class="person-table-scroll">' +
      '<table class="person-main-table person-project-detail-table">' +
        colGroup +
        tableHead +
        '<tbody>' + body + '</tbody>' +
      '</table>' +
    '</div>' +
  '</section>';
}

function buildPersonProjectPeopleHtml(project) {
  if (!project.people || !project.people.length) return '<div class="person-empty">暂无人员对比数据。</div>';
  return '<div class="person-project-people-wrap">' +
    '<table class="person-project-people-table">' +
      '<thead><tr><th>制作部门</th><th>制作人员</th><th>员工状态</th><th>在职年数</th><th>效率分类</th><th>评估效率</th><th>节省工时</th><th>实际耗时</th><th>基准耗时</th><th>产出数</th><th>基准覆盖率</th></tr></thead>' +
      '<tbody>' + project.people.map(item =>
        '<tr>' +
          '<td>' + escapeHtml(item.dept) + '</td>' +
          '<td>' + escapeHtml(item.person) + '</td>' +
          '<td>' + buildEmployeeStatusBadge(item) + '</td>' +
          '<td class="num">' + formatPersonTenure(item.tenureYears) + '</td>' +
          '<td>' + buildPersonClassBadge(item.className) + '</td>' +
          '<td class="num">' + formatPersonEfficiency(item.efficiency) + '</td>' +
          '<td class="num ' + ((item.savedWorkload || 0) >= 0 ? 'person-good' : 'person-bad') + '">' + formatPersonNumber(item.savedWorkload, 1) + '</td>' +
          '<td class="num">' + formatPersonNumber(item.evaluatedWorkload, 1) + '</td>' +
          '<td class="num">' + formatPersonNumber(item.expectedWorkload, 1) + '</td>' +
          '<td class="num">' + formatPersonNumber(item.evaluatedOutput, 0) + '</td>' +
          '<td class="num">' + formatPersonPct(item.baselineCoverage) + '</td>' +
        '</tr>'
      ).join('') + '</tbody>' +
    '</table>' +
  '</div>';
}

function buildPersonProjectSectionHtml() {
  const projects = (PERSON_EFFICIENCY_DATA.topProjectsByPeriod || {})[appState.personPeriod] || [];
  if (!projects.length) return '<section class="person-panel"><div class="person-section-title">需求量 TOP10 项目人员效率对比</div><div class="person-empty">当前统计范围暂无满足制作部门数 >= 2 的项目。</div></section>';
  return '<section class="person-panel" id="personProjectSection">' +
    '<div class="person-section-head"><div><div class="person-section-title">需求量 TOP10 项目人员效率对比</div></div></div>' +
    '<div class="person-project-list">' +
      projects.map((project, idx) => {
        const open = appState.personProjectExpanded === idx;
        const title = [project.center, project.demandDept, project.product, project.businessUnit].filter(Boolean).join(' / ');
        return '<div class="person-project-card">' +
          '<button class="person-project-head" type="button" onclick="togglePersonProject(' + idx + ')">' +
            '<span class="person-project-rank">#' + (idx + 1) + '</span>' +
            '<span class="person-project-title">' + escapeHtml(title || '-') + '</span>' +
            '<span class="person-project-metrics">产出 ' + formatPersonNumber(project.output, 0) + ' · 部门 ' + project.deptCount + ' · 评估效率 ' + formatPersonEfficiency(project.efficiency) + '</span>' +
          '</button>' +
          (open ? buildPersonProjectPeopleHtml(project) : '') +
        '</div>';
      }).join('') +
    '</div>' +
  '</section>';
}

function renderPersonProjectSection() {
  const section = document.getElementById('personProjectMount');
  if (section) section.innerHTML = buildPersonProjectSectionHtml();
}

function renderPersonEfficiencyPage(container) {
  if (!PERSON_EFFICIENCY_DATA.rows || !PERSON_EFFICIENCY_DATA.rows.length) {
    container.innerHTML = '<section class="person-page"><div class="person-empty">暂无人员效率数据。</div></section>';
    return;
  }
  if (!getPersonPeriods().includes(appState.personPeriod)) {
    appState.personPeriod = getPersonPeriods()[0];
  }
  container.innerHTML =
    '<section class="person-page">' +
      buildPersonLogicHtml() +
      buildPersonDepartmentSummaryHtml() +
      buildPersonAnalysisHtml() +
      buildPersonMainTableHtml() +
      buildPersonProjectDetailTableHtml() +
    '</section>';
  renderPersonDepartmentCharts();
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

function getContentEditingWeekRangeLabelV3(weekKey) {
  const parsed = parseWeekKeyV3(weekKey);
  if (!parsed) return weekKey || '-';
  const workdayStart = getIsoWeekStartV3(parsed.year, parsed.week);
  const workdayEnd = getWeekEndDateV3(weekKey);
  const materialStart = addUtcDaysV3(workdayStart, -3);
  const materialEnd = addUtcDaysV3(workdayStart, 3);
  return weekKey + ' | 素材 ' + formatUtcMMDDRangeV3(materialStart, materialEnd, '-') +
    ' | 工作日 ' + formatUtcMMDDRangeV3(workdayStart, workdayEnd, '-');
}

function getModuleWeekRangeLabelV3(moduleName, weekKey) {
  return moduleName === CONTENT_EDITING_MODULE
    ? getContentEditingWeekRangeLabelV3(weekKey)
    : getWeekRangeLabelV3(weekKey);
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
  const personActive = appState.mainView === 'person' ? ' active' : '';
  const app = document.getElementById('app');
  app.innerHTML =
    '<div class="bi-shell">' +
      '<div class="top-nav top-nav-v2">' +
        '<button class="top-nav-btn top-nav-primary' + overviewActive + '" type="button" onclick="setMainView(\'overview\')"'+ (overviewActive ? ' aria-current="page"' : '') +'>' + OVERVIEW_TEXT_V3.overview + '</button>' +
        '<div class="top-nav-section" aria-label="素材模块">' + moduleNavButtons + '</div>' +
        '<button class="top-nav-btn top-nav-primary' + businessActive + '" type="button" onclick="setMainView(\'business\')"'+ (businessActive ? ' aria-current="page"' : '') +'>' + OVERVIEW_TEXT_V3.inputOutput + '</button>' +
        '<button class="top-nav-btn top-nav-primary' + personActive + '" type="button" onclick="setMainView(\'person\')"'+ (personActive ? ' aria-current="page"' : '') +'>人员效率</button>' +
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
    ? '<div class="period-range-callout">最新周 ' + getModuleWeekRangeLabelV3(activeModule, latestWeek) + '</div>'
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
            '<button class="toggle-btn anomaly-toggle-btn' + (appState.anomalyBriefVisible ? ' active' : '') + '" onclick="toggleAnomalyBrief()">波动分析</button>' +
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
