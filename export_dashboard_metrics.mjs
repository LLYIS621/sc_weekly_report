import childProcess from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.dirname(ROOT_DIR);
const PYTHON = process.env.PYTHON || "python";
const SOURCE_SCRIPT = path.join(ROOT_DIR, "generate_dashboard.py");
const TEMPLATE_FILE = path.join(ROOT_DIR, "template.html");
const OUTPUT_ROOT = path.join(ROOT_DIR, "outputs", "dashboard_metric_exports");
const RUN_STAMP = timestamp();
const RUN_DIR = path.join(OUTPUT_ROOT, RUN_STAMP);
const TEMP_DIR = path.join(RUN_DIR, "_director_payload");
const PREVIEW_DIR = path.join(RUN_DIR, "_previews");
const TEMP_SCRIPT = path.join(TEMP_DIR, "generate_dashboard_with_director.py");
const TEMP_HTML = path.join(TEMP_DIR, "index.html");
const OUTPUT_XLSX = path.join(RUN_DIR, `仪表盘展示指标导出_${RUN_STAMP}.xlsx`);

const OUTPUT_MODULES = [
  { label: "图片", moduleName: "图片", excludeDepts: [] },
  { label: "混剪", moduleName: "混剪", excludeDepts: [] },
  { label: "拍摄", moduleName: "内容团队-摄像", excludeDepts: [] },
];

const MATERIAL_TIME_MODULES = [
  { label: "图片", moduleName: "图片", excludeDepts: [], includeTotal: true },
  { label: "混剪", moduleName: "混剪", excludeDepts: ["品牌设计部"], includeTotal: true },
];

const ROLE_TIME_MODULES = [
  { label: "编剧", moduleName: "内容团队-编剧" },
  { label: "导演", moduleName: "内容团队-导演" },
  { label: "拍摄", moduleName: "内容团队-摄像" },
  { label: "剪辑", moduleName: "内容团队-剪辑" },
];

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "_",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

async function buildDirectorPayload() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.copyFile(TEMPLATE_FILE, path.join(TEMP_DIR, "template.html"));

  let script = await fs.readFile(SOURCE_SCRIPT, "utf8");
  script = script.replace(
    "BASE_DIR = os.path.dirname(SCRIPT_DIR)",
    `BASE_DIR = r'${BASE_DIR.replaceAll("\\", "\\\\")}'`,
  );
  script = script.replace(
    /('name': '内容团队-导演'[\s\S]*?'hidden': )True/,
    "$1False",
  );
  await fs.writeFile(TEMP_SCRIPT, script, "utf8");

  const run = childProcess.spawnSync(PYTHON, [TEMP_SCRIPT], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const logText = `${run.stdout || ""}${run.stderr || ""}`;
  await fs.writeFile(path.join(TEMP_DIR, "generate_dashboard.log"), logText, "utf8");
  if (run.status !== 0) {
    const tail = logText.split(/\r?\n/).slice(-40).join("\n");
    throw new Error(`生成包含导演的临时仪表盘失败。\n${tail}`);
  }
}

function loadPayload(html) {
  const match = html.match(/<script>\s*window\.DASHBOARD_PAYLOAD = ([\s\S]*?)\n<\/script>/);
  if (!match) throw new Error("临时仪表盘中未找到 window.DASHBOARD_PAYLOAD");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(`window.DASHBOARD_PAYLOAD = ${match[1]}`, context);
  return context.window.DASHBOARD_PAYLOAD;
}

function latestMonths(payload, count) {
  const months = payload.MONTH_LABELS || Object.keys(payload.DATA.monthly["图片"].total_metrics || {});
  if (months.length < count) throw new Error(`可用月份少于 ${count} 个，无法导出。`);
  return months.slice(-count);
}

function moduleDepts(payload, moduleName, excludeDepts = [], includeTotal = false) {
  const data = payload.DATA.monthly[moduleName];
  if (!data) throw new Error(`缺少模块数据: ${moduleName}`);
  const rows = includeTotal ? ["总计"] : [];
  return rows.concat((data.depts || []).filter((dept) => !excludeDepts.includes(dept)));
}

function metric(payload, moduleName, dept, month, key) {
  const data = payload.DATA.monthly[moduleName];
  const source = dept === "总计" ? data.total_metrics : data.dept_metrics[dept];
  const value = source && source[month] ? source[month][key] : "";
  return value === undefined || value === null ? "" : value;
}

function monthOverMonth(curr, prev) {
  const currentValue = Number(curr);
  const previousValue = Number(prev);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) return "";
  return (currentValue - previousValue) / previousValue;
}

function columnName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function writeTitle(sheet, title, colCount) {
  const lastCol = columnName(colCount - 1);
  sheet.getRange(`A1:${lastCol}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format = {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF", size: 15 },
  };
}

function styleSheet(sheet, usedRange, headerRange, widths) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(2);
  sheet.getRange(headerRange).format = {
    fill: "#134E4A",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
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

function addProductionOutputSheet(workbook, payload, twoMonths) {
  const [prevMonth, currMonth] = twoMonths;
  const sheet = workbook.worksheets.add("近两月产出");
  const headers = [
    "业务类型",
    "制作部门",
    `总产出_${prevMonth}`,
    `总产出_${currMonth}`,
    "总产出_月环比",
    `人均日均产出_${prevMonth}`,
    `人均日均产出_${currMonth}`,
    "人均日均产出_月环比",
  ];
  const rows = [];
  for (const config of OUTPUT_MODULES) {
    for (const dept of moduleDepts(payload, config.moduleName, config.excludeDepts)) {
      const prevOutput = metric(payload, config.moduleName, dept, prevMonth, "total_output");
      const currOutput = metric(payload, config.moduleName, dept, currMonth, "total_output");
      const prevAvg = metric(payload, config.moduleName, dept, prevMonth, "avg_daily_output");
      const currAvg = metric(payload, config.moduleName, dept, currMonth, "avg_daily_output");
      rows.push([
        config.label,
        dept,
        prevOutput,
        currOutput,
        monthOverMonth(currOutput, prevOutput),
        prevAvg,
        currAvg,
        monthOverMonth(currAvg, prevAvg),
      ]);
    }
  }
  const matrix = [headers, ...rows];
  writeTitle(sheet, "图片、混剪、拍摄各制作部门近两月产出", headers.length);
  sheet.getRangeByIndexes(1, 0, matrix.length, headers.length).values = matrix;
  styleSheet(sheet, `A2:H${matrix.length + 1}`, "A2:H2", [14, 16, 16, 16, 14, 20, 20, 18]);
  sheet.getRange(`C3:D${matrix.length + 1}`).format.numberFormat = "#,##0";
  sheet.getRange(`E3:E${matrix.length + 1}`).format.numberFormat = "0.0%";
  sheet.getRange(`F3:G${matrix.length + 1}`).format.numberFormat = "#,##0.0";
  sheet.getRange(`H3:H${matrix.length + 1}`).format.numberFormat = "0.0%";
}

function addMaterialTimeSheet(workbook, payload, threeMonths) {
  const sheet = workbook.worksheets.add("图片混剪近三月耗时");
  const headers = ["业务类型", "制作部门", ...threeMonths.map((month) => `${month}单素材耗时(min)`)];
  const rows = [];
  for (const config of MATERIAL_TIME_MODULES) {
    for (const dept of moduleDepts(payload, config.moduleName, config.excludeDepts, config.includeTotal)) {
      rows.push([
        config.label,
        dept,
        ...threeMonths.map((month) => metric(payload, config.moduleName, dept, month, "single_time")),
      ]);
    }
  }
  const matrix = [headers, ...rows];
  writeTitle(sheet, "图片和混剪各制作部门近三月单素材耗时", headers.length);
  sheet.getRangeByIndexes(1, 0, matrix.length, headers.length).values = matrix;
  styleSheet(sheet, `A2:E${matrix.length + 1}`, "A2:E2", [14, 16, 22, 22, 22]);
  sheet.getRange(`C3:E${matrix.length + 1}`).format.numberFormat = "#,##0.0";
}

function addRoleTimeSheet(workbook, payload, threeMonths) {
  const sheet = workbook.worksheets.add("内容岗位近三月耗时");
  const headers = ["岗位", "制作部门", ...threeMonths.map((month) => `${month}单素材耗时(min)`)];
  const rows = [];
  for (const config of ROLE_TIME_MODULES) {
    for (const dept of moduleDepts(payload, config.moduleName, [], true)) {
      rows.push([
        config.label,
        dept,
        ...threeMonths.map((month) => metric(payload, config.moduleName, dept, month, "single_time")),
      ]);
    }
  }
  const matrix = [headers, ...rows];
  writeTitle(sheet, "编剧、导演、拍摄、剪辑近三月单素材耗时", headers.length);
  sheet.getRangeByIndexes(1, 0, matrix.length, headers.length).values = matrix;
  styleSheet(sheet, `A2:E${matrix.length + 1}`, "A2:E2", [14, 16, 22, 22, 22]);
  sheet.getRange(`C3:E${matrix.length + 1}`).format.numberFormat = "#,##0.0";
}

async function renderPreviews(workbook) {
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  for (const sheetName of ["近两月产出", "图片混剪近三月耗时", "内容岗位近三月耗时"]) {
    const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(path.join(PREVIEW_DIR, `${sheetName}.png`), new Uint8Array(await preview.arrayBuffer()));
  }
}

async function main() {
  await fs.mkdir(RUN_DIR, { recursive: true });
  await buildDirectorPayload();
  const payload = loadPayload(await fs.readFile(TEMP_HTML, "utf8"));
  const twoMonths = latestMonths(payload, 2);
  const threeMonths = latestMonths(payload, 3);

  const workbook = Workbook.create();
  addProductionOutputSheet(workbook, payload, twoMonths);
  addMaterialTimeSheet(workbook, payload, threeMonths);
  addRoleTimeSheet(workbook, payload, threeMonths);
  await renderPreviews(workbook);

  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
  });
  console.log(errors.ndjson);

  const sample = await workbook.inspect({
    kind: "table",
    range: "近两月产出!A2:H12",
    include: "values",
    tableMaxRows: 12,
    tableMaxCols: 8,
  });
  console.log(sample.ndjson);

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(OUTPUT_XLSX);
  console.log(`saved=${OUTPUT_XLSX}`);
}

await main();
