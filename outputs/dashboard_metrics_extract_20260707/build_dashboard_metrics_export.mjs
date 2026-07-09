import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const ROOT = new URL("../../", import.meta.url);
const INDEX_HTML = new URL("index.html", ROOT);
const OUTPUT_DIR = new URL("./", import.meta.url);
const OUTPUT_XLSX = new URL("仪表盘展示指标导出_20260707.xlsx", OUTPUT_DIR);
const OUTPUT_XLSX_PATH = fileURLToPath(OUTPUT_XLSX);

const RECENT_TWO_MONTHS = ["2026-05", "2026-06"];
const RECENT_THREE_MONTHS = ["2026-04", "2026-05", "2026-06"];
const OUTPUT_MODULES = ["图片", "混剪"];
const CAMERA_MODULE = "内容团队-摄像";
const CONTENT_ROLE_MODULES = [
  ["编剧", "内容团队-编剧"],
  ["导演", "内容团队-导演"],
  ["摄像", "内容团队-摄像"],
  ["剪辑", "内容团队-剪辑"],
];

function loadPayload(html) {
  const match = html.match(/<script>\s*window\.DASHBOARD_PAYLOAD = ([\s\S]*?)\n<\/script>/);
  if (!match) throw new Error("index.html 中未找到 window.DASHBOARD_PAYLOAD");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(`window.DASHBOARD_PAYLOAD = ${match[1]}`, context);
  return context.window.DASHBOARD_PAYLOAD;
}

function n(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function moduleData(payload, moduleName) {
  return payload.DATA.monthly[moduleName] || null;
}

function getRowsForModule(data, includeTotal = false) {
  const rows = [];
  if (includeTotal && data.total_metrics) rows.push(["总计", data.total_metrics, true]);
  for (const dept of data.depts || []) rows.push([dept, data.dept_metrics[dept] || {}, false]);
  return rows;
}

function twoMonthOutputRows(payload, moduleNames) {
  const rows = [];
  for (const moduleName of moduleNames) {
    const data = moduleData(payload, moduleName);
    if (!data) continue;
    for (const [dept, metricsByMonth] of getRowsForModule(data, false)) {
      const monthMetrics = RECENT_TWO_MONTHS.map((month) => metricsByMonth[month] || {});
      const totalOutput = monthMetrics.reduce((sum, item) => sum + n(item.total_output), 0);
      const denominator = monthMetrics.reduce(
        (sum, item) => sum + n(item.workdays) * n(item.output_manpower),
        0,
      );
      rows.push({
        moduleName,
        dept,
        period: RECENT_TWO_MONTHS.join("~"),
        totalOutput: round(totalOutput, 1),
        denominator: round(denominator, 2),
        avgDailyOutput: denominator ? round(totalOutput / denominator, 1) : null,
        monthValues: monthMetrics.map((item) => ({
          totalOutput: round(n(item.total_output), 1),
          avgDailyOutput: round(n(item.avg_daily_output), 1),
        })),
        note: "期间人均日均产出=近两月总产出/Σ(月工作日×产出用人力)",
      });
    }
  }
  return rows;
}

function threeMonthSingleTimeRows(payload, moduleNames, includeTotal = false) {
  const rows = [];
  for (const moduleName of moduleNames) {
    const data = moduleData(payload, moduleName);
    if (!data) continue;
    for (const [dept, metricsByMonth] of getRowsForModule(data, includeTotal)) {
      const monthMetrics = RECENT_THREE_MONTHS.map((month) => metricsByMonth[month] || {});
      const totalWorkload = monthMetrics.reduce((sum, item) => sum + n(item.total_workload), 0);
      const efficiencyOutput = monthMetrics.reduce((sum, item) => sum + n(item.efficiency_output), 0);
      rows.push({
        moduleName,
        dept,
        period: RECENT_THREE_MONTHS.join("~"),
        totalWorkload: round(totalWorkload, 2),
        efficiencyOutput: round(efficiencyOutput, 1),
        singleTime: efficiencyOutput ? round((totalWorkload * 60) / efficiencyOutput, 1) : null,
        monthValues: monthMetrics.map((item) => round(n(item.single_time), 1)),
        note: "期间单素材耗时=Σ总工时×60/Σ效率产出",
      });
    }
  }
  return rows;
}

function contentRoleSingleTimeRows(payload) {
  const rows = [];
  for (const [role, moduleName] of CONTENT_ROLE_MODULES) {
    const data = moduleData(payload, moduleName);
    if (!data) {
      rows.push({
        role,
        moduleName,
        dept: "全部",
        period: RECENT_THREE_MONTHS.join("~"),
        totalWorkload: null,
        efficiencyOutput: null,
        singleTime: null,
        monthValues: [null, null, null],
        note: "当前仪表盘展示 payload 未包含该模块；未从源表另算",
      });
      continue;
    }
    for (const [dept, metricsByMonth] of getRowsForModule(data, true)) {
      const monthMetrics = RECENT_THREE_MONTHS.map((month) => metricsByMonth[month] || {});
      const totalWorkload = monthMetrics.reduce((sum, item) => sum + n(item.total_workload), 0);
      const efficiencyOutput = monthMetrics.reduce((sum, item) => sum + n(item.efficiency_output), 0);
      rows.push({
        role,
        moduleName,
        dept,
        period: RECENT_THREE_MONTHS.join("~"),
        totalWorkload: round(totalWorkload, 2),
        efficiencyOutput: round(efficiencyOutput, 1),
        singleTime: efficiencyOutput ? round((totalWorkload * 60) / efficiencyOutput, 1) : null,
        monthValues: monthMetrics.map((item) => round(n(item.single_time), 1)),
        note: dept === "总计" ? "岗位总计，基于仪表盘 total_metrics" : "部门明细，基于仪表盘 dept_metrics",
      });
    }
  }
  return rows;
}

function writeTitle(sheet, title, subtitle, colCount) {
  const lastCol = String.fromCharCode("A".charCodeAt(0) + colCount - 1);
  sheet.getRange(`A1:${lastCol}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A2:${lastCol}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A1").format = {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF", size: 15 },
  };
  sheet.getRange("A2").format = {
    fill: "#E0F2F1",
    font: { color: "#134E4A", size: 10 },
  };
}

function styleDataSheet(sheet, usedRange, headerRange, widths) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(3);
  sheet.getRange(headerRange).format = {
    fill: "#134E4A",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  sheet.getRange(usedRange).format.borders = {
    preset: "all",
    style: "thin",
    color: "#D7E3E1",
  };
  sheet.getRange(usedRange).format.font = { name: "Microsoft YaHei", size: 10 };
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width;
  });
}

function safeCellValue(value) {
  return value === null || value === undefined ? "" : value;
}

function addOutputSheet(workbook, name, title, rows) {
  const sheet = workbook.worksheets.add(name);
  const headers = [
    "模块",
    "制作部门",
    "期间",
    "近两月总产出",
    "期间工作日人力合计",
    "近两月人均日均产出",
    `${RECENT_TWO_MONTHS[0]}总产出`,
    `${RECENT_TWO_MONTHS[0]}人均日均产出`,
    `${RECENT_TWO_MONTHS[1]}总产出`,
    `${RECENT_TWO_MONTHS[1]}人均日均产出`,
    "口径说明",
  ];
  writeTitle(sheet, title, "数据直接取自当前 index.html 的仪表盘展示 payload；期间汇总按展示字段加权计算。", headers.length);
  const matrix = [headers].concat(rows.map((row) => [
    row.moduleName,
    row.dept,
    row.period,
    row.totalOutput,
    row.denominator,
    row.avgDailyOutput,
    row.monthValues[0].totalOutput,
    row.monthValues[0].avgDailyOutput,
    row.monthValues[1].totalOutput,
    row.monthValues[1].avgDailyOutput,
    row.note,
  ]));
  sheet.getRangeByIndexes(2, 0, matrix.length, headers.length).values = matrix;
  if (rows.length) {
    sheet.getRangeByIndexes(3, 5, rows.length, 1).formulasR1C1 = rows.map(() => ["=IFERROR(RC[-2]/RC[-1],\"\")"]);
  }
  styleDataSheet(sheet, `A3:K${matrix.length + 2}`, "A3:K3", [13, 15, 20, 14, 18, 18, 14, 18, 14, 18, 42]);
  sheet.getRange(`D4:J${matrix.length + 2}`).format.numberFormat = "#,##0.0";
  return sheet;
}

function addSingleTimeSheet(workbook, name, title, rows, firstHeader = "模块") {
  const sheet = workbook.worksheets.add(name);
  const headers = [
    firstHeader,
    "制作部门",
    "期间",
    "近三月总工时(h)",
    "近三月效率产出",
    "近三月单素材耗时(min)",
    `${RECENT_THREE_MONTHS[0]}单素材耗时(min)`,
    `${RECENT_THREE_MONTHS[1]}单素材耗时(min)`,
    `${RECENT_THREE_MONTHS[2]}单素材耗时(min)`,
    "口径说明",
  ];
  writeTitle(sheet, title, "数据直接取自当前 index.html 的仪表盘展示 payload；期间单素材耗时按总工时和效率产出加权计算。", headers.length);
  const matrix = [headers].concat(rows.map((row) => [
    firstHeader === "岗位" ? row.role : row.moduleName,
    row.dept,
    row.period,
    safeCellValue(row.totalWorkload),
    safeCellValue(row.efficiencyOutput),
    safeCellValue(row.singleTime),
    safeCellValue(row.monthValues[0]),
    safeCellValue(row.monthValues[1]),
    safeCellValue(row.monthValues[2]),
    row.note,
  ]));
  sheet.getRangeByIndexes(2, 0, matrix.length, headers.length).values = matrix;
  if (rows.length) {
    sheet.getRangeByIndexes(3, 5, rows.length, 1).formulasR1C1 = rows.map((row) => [
      row.singleTime === null ? "" : "=IFERROR(RC[-2]*60/RC[-1],\"\")",
    ]);
  }
  styleDataSheet(sheet, `A3:J${matrix.length + 2}`, "A3:J3", [15, 15, 24, 17, 17, 20, 20, 20, 20, 42]);
  sheet.getRange(`D4:I${matrix.length + 2}`).format.numberFormat = "#,##0.0";
  return sheet;
}

function addNotesSheet(workbook, payload) {
  const sheet = workbook.worksheets.add("口径说明");
  sheet.showGridLines = false;
  const rows = [
    ["项目", "说明"],
    ["数据来源", "当前工作区 index.html 内嵌的 window.DASHBOARD_PAYLOAD.DATA.monthly，与仪表盘页面展示数据一致。"],
    ["近两月", RECENT_TWO_MONTHS.join("、")],
    ["近三月", RECENT_THREE_MONTHS.join("、")],
    ["总产出", "取各模块各部门月度 total_output，并按期间求和。"],
    ["人均日均产出", "期间汇总=Σtotal_output / Σ(workdays × output_manpower)；月度列保留仪表盘 avg_daily_output。"],
    ["单素材耗时", "期间汇总=Σtotal_workload × 60 / Σefficiency_output；月度列保留仪表盘 single_time。"],
    ["导演数据", "当前仪表盘 payload 未包含 内容团队-导演；Excel 中保留提示行，未从原始源表另算。"],
    ["仪表盘月份", (payload.MONTH_LABELS || []).join("、")],
  ];
  sheet.getRangeByIndexes(0, 0, rows.length, 2).values = rows;
  sheet.getRange("A1:B1").format = {
    fill: "#134E4A",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.getRange(`A1:B${rows.length}`).format.borders = {
    preset: "all",
    style: "thin",
    color: "#D7E3E1",
  };
  sheet.getRange("A:A").format.columnWidth = 18;
  sheet.getRange("B:B").format.columnWidth = 86;
  sheet.getRange(`B1:B${rows.length}`).format.wrapText = true;
  return sheet;
}

const html = await fs.readFile(INDEX_HTML, "utf8");
const payload = loadPayload(html);

const workbook = Workbook.create();
addNotesSheet(workbook, payload);
addOutputSheet(workbook, "图片混剪近两月产出", "图片和混剪各制作部门近两月产出", twoMonthOutputRows(payload, OUTPUT_MODULES));
addOutputSheet(workbook, "摄像近两月产出", "摄像岗位各制作部门近两月产出", twoMonthOutputRows(payload, [CAMERA_MODULE]));
addSingleTimeSheet(workbook, "图片混剪近三月耗时", "图片和混剪各制作部门近三月单素材耗时", threeMonthSingleTimeRows(payload, OUTPUT_MODULES));
addSingleTimeSheet(workbook, "内容岗位近三月耗时", "编剧、导演、摄像、剪辑近三月单素材耗时", contentRoleSingleTimeRows(payload), "岗位");

for (const sheetName of ["口径说明", "图片混剪近两月产出", "摄像近两月产出", "图片混剪近三月耗时", "内容岗位近三月耗时"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(new URL(`${sheetName}.png`, OUTPUT_DIR), new Uint8Array(await preview.arrayBuffer()));
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const sample = await workbook.inspect({
  kind: "table",
  range: "图片混剪近两月产出!A3:K8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 11,
});
console.log(sample.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUTPUT_XLSX_PATH);
console.log(`saved=${OUTPUT_XLSX_PATH}`);
