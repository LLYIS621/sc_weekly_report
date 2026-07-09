import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const OUT_DIR = new URL("./", import.meta.url);
const PAYLOAD_HTML = new URL("director_temp/index.html", OUT_DIR);
const OUTPUT_XLSX = fileURLToPath(new URL("仪表盘展示指标导出_直接月度结果_20260707.xlsx", OUT_DIR));
const TWO_MONTHS = ["2026-05", "2026-06"];
const THREE_MONTHS = ["2026-04", "2026-05", "2026-06"];

function loadPayload(html) {
  const match = html.match(/<script>\s*window\.DASHBOARD_PAYLOAD = ([\s\S]*?)\n<\/script>/);
  if (!match) throw new Error("未找到 window.DASHBOARD_PAYLOAD");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(`window.DASHBOARD_PAYLOAD = ${match[1]}`, context);
  return context.window.DASHBOARD_PAYLOAD;
}

function metric(payload, moduleName, dept, month, key) {
  const data = payload.DATA.monthly[moduleName];
  if (!data) return "";
  const source = dept === "总计" ? data.total_metrics : data.dept_metrics[dept];
  const value = source && source[month] ? source[month][key] : "";
  return value === undefined || value === null ? "" : value;
}

function moduleDeptRows(payload, moduleName, includeTotal = false) {
  const data = payload.DATA.monthly[moduleName];
  if (!data) return [];
  const rows = [];
  if (includeTotal) rows.push("总计");
  return rows.concat(data.depts || []);
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

function styleSheet(sheet, range, headerRange, widths) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(3);
  sheet.getRange(headerRange).format = {
    fill: "#134E4A",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange(range).format.borders = {
    preset: "all",
    style: "thin",
    color: "#D7E3E1",
  };
  sheet.getRange(range).format.font = { name: "Microsoft YaHei", size: 10 };
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 1, 1).format.columnWidth = width;
  });
}

function addOutputSheet(workbook, payload, sheetName, title, modules) {
  const sheet = workbook.worksheets.add(sheetName);
  const headers = [
    "模块",
    "制作部门",
    `${TWO_MONTHS[0]}总产出`,
    `${TWO_MONTHS[0]}人均日均产出`,
    `${TWO_MONTHS[1]}总产出`,
    `${TWO_MONTHS[1]}人均日均产出`,
  ];
  writeTitle(sheet, title, "直接取仪表盘计算结果对应月份字段，不做近两月合并或加权重算。", headers.length);
  const rows = [];
  for (const moduleName of modules) {
    for (const dept of moduleDeptRows(payload, moduleName, false)) {
      rows.push([
        moduleName,
        dept,
        metric(payload, moduleName, dept, TWO_MONTHS[0], "total_output"),
        metric(payload, moduleName, dept, TWO_MONTHS[0], "avg_daily_output"),
        metric(payload, moduleName, dept, TWO_MONTHS[1], "total_output"),
        metric(payload, moduleName, dept, TWO_MONTHS[1], "avg_daily_output"),
      ]);
    }
  }
  const matrix = [headers, ...rows];
  sheet.getRangeByIndexes(2, 0, matrix.length, headers.length).values = matrix;
  styleSheet(sheet, `A3:F${matrix.length + 2}`, "A3:F3", [16, 16, 16, 18, 16, 18]);
  sheet.getRange(`C4:F${matrix.length + 2}`).format.numberFormat = "#,##0.0";
  return sheet;
}

function addSingleTimeSheet(workbook, payload, sheetName, title, modulePairs, includeTotal) {
  const sheet = workbook.worksheets.add(sheetName);
  const headers = ["模块/岗位", "制作部门"];
  for (const month of THREE_MONTHS) headers.push(`${month}单素材耗时(min)`);
  writeTitle(sheet, title, "直接取仪表盘计算结果对应月份 single_time，不做近三月合并或加权重算。", headers.length);
  const rows = [];
  for (const [label, moduleName] of modulePairs) {
    for (const dept of moduleDeptRows(payload, moduleName, includeTotal)) {
      rows.push([
        label,
        dept,
        metric(payload, moduleName, dept, THREE_MONTHS[0], "single_time"),
        metric(payload, moduleName, dept, THREE_MONTHS[1], "single_time"),
        metric(payload, moduleName, dept, THREE_MONTHS[2], "single_time"),
      ]);
    }
  }
  const matrix = [headers, ...rows];
  sheet.getRangeByIndexes(2, 0, matrix.length, headers.length).values = matrix;
  styleSheet(sheet, `A3:E${matrix.length + 2}`, "A3:E3", [16, 16, 22, 22, 22]);
  sheet.getRange(`C4:E${matrix.length + 2}`).format.numberFormat = "#,##0.0";
  return sheet;
}

function addNotes(workbook, payload) {
  const sheet = workbook.worksheets.add("口径说明");
  sheet.showGridLines = false;
  const rows = [
    ["项目", "说明"],
    ["数据源", "基于 generate_dashboard.py 同一计算逻辑生成的临时 payload；导演模块由隐藏改为参与计算，仅用于本次导出。"],
    ["近两月", TWO_MONTHS.join("、")],
    ["近三月", THREE_MONTHS.join("、")],
    ["产出指标", "直接导出各月 total_output、avg_daily_output。"],
    ["耗时指标", "直接导出各月 single_time。"],
    ["包含模块", Object.keys(payload.DATA.monthly).join("、")],
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
  sheet.getRange("B:B").format.columnWidth = 100;
  sheet.getRange(`B1:B${rows.length}`).format.wrapText = true;
}

const payload = loadPayload(await fs.readFile(PAYLOAD_HTML, "utf8"));
const workbook = Workbook.create();

addNotes(workbook, payload);
addOutputSheet(workbook, payload, "图片混剪近两月产出", "图片和混剪各制作部门近两月产出", ["图片", "混剪"]);
addOutputSheet(workbook, payload, "摄像近两月产出", "摄像岗位各制作部门近两月产出", ["内容团队-摄像"]);
addSingleTimeSheet(
  workbook,
  payload,
  "图片混剪近三月耗时",
  "图片和混剪各制作部门近三月单素材耗时",
  [["图片", "图片"], ["混剪", "混剪"]],
  false,
);
addSingleTimeSheet(
  workbook,
  payload,
  "内容岗位近三月耗时",
  "编剧、导演、摄像、剪辑近三月单素材耗时",
  [["编剧", "内容团队-编剧"], ["导演", "内容团队-导演"], ["摄像", "内容团队-摄像"], ["剪辑", "内容团队-剪辑"]],
  true,
);

for (const sheetName of ["口径说明", "图片混剪近两月产出", "摄像近两月产出", "图片混剪近三月耗时", "内容岗位近三月耗时"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(new URL(`${sheetName}_direct.png`, OUT_DIR), new Uint8Array(await preview.arrayBuffer()));
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
});
console.log(errors.ndjson);

const sample = await workbook.inspect({
  kind: "table",
  range: "内容岗位近三月耗时!A3:E16",
  include: "values",
  tableMaxRows: 16,
  tableMaxCols: 5,
});
console.log(sample.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUTPUT_XLSX);
console.log(`saved=${OUTPUT_XLSX}`);
