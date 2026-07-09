import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/single_piece_project_score_20260709_3-6月";
const dataPath = path.join(outputDir, "score_data.json");
const outputPath = path.join(outputDir, "单片消耗贡献_项目打分汇总_含项目消耗_3-6月_20260709.xlsx");

const payload = JSON.parse(await fs.readFile(dataPath, "utf8"));

function toMatrix(rows, columns) {
  return [
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? null)),
  ];
}

function writeSheet(workbook, sheetName, rows, columns, numberFormats = {}) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.showGridLines = false;
  const matrix = toMatrix(rows, columns);
  const range = sheet.getRangeByIndexes(0, 0, matrix.length, columns.length);
  range.values = matrix;
  sheet.freezePanes.freezeRows(1);

  const header = sheet.getRangeByIndexes(0, 0, 1, columns.length);
  header.format = {
    fill: "#1F4E78",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
  range.format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };

  for (let i = 0; i < columns.length; i += 1) {
    const column = columns[i];
    const bodyRange = sheet.getRangeByIndexes(1, i, Math.max(matrix.length - 1, 1), 1);
    if (numberFormats[column]) {
      bodyRange.format.numberFormat = numberFormats[column];
    }
    if (["月份", "绩效月份", "素材大类", "是否参与评分"].includes(column)) {
      bodyRange.format.horizontalAlignment = "center";
    }
  }

  range.format.autofitColumns();
  range.format.autofitRows();
  return sheet;
}

const workbook = Workbook.create();

writeSheet(
  workbook,
  "部门素材类型平均分",
  payload.material_summary,
  ["月份", "制作部门", "素材大类", "参与评分项目数", "项目平均分", "项目单片消耗贡献均值"],
  {
    "参与评分项目数": "#,##0",
    "项目平均分": "0.0000",
    "项目单片消耗贡献均值": "#,##0.0000",
  },
);

writeSheet(
  workbook,
  "部门月度均分",
  payload.dept_summary,
  ["月份", "制作部门", "参与素材类数", "多类项目平均分"],
  {
    "参与素材类数": "#,##0",
    "多类项目平均分": "0.0000",
  },
);

writeSheet(
  workbook,
  "项目明细得分",
  payload.project_detail,
  [
    "月份",
    "制作部门",
    "素材大类",
    "运营部门",
    "产品名称",
    "项目消耗",
    "制作部门素材消耗",
    "素材产出量",
    "项目单片消耗贡献",
    "项目得分",
    "是否参与评分",
    "不参与评分原因",
  ],
  {
    "项目消耗": "#,##0.0000",
    "制作部门素材消耗": "#,##0.0000",
    "素材产出量": "#,##0.0000",
    "项目单片消耗贡献": "#,##0.0000",
    "项目得分": "0",
  },
);

writeSheet(
  workbook,
  "评分阈值",
  payload.thresholds,
  ["素材大类", "65分", "75分", "80分", "85分", "90分", "95分"],
  {
    "75分": "#,##0",
    "80分": "#,##0",
    "85分": "#,##0",
    "90分": "#,##0",
    "95分": "#,##0",
  },
);

const summarySheet = workbook.worksheets.getItem("部门素材类型平均分");
summarySheet.getRange("A1:F1").format.fill = "#305496";
const deptSheet = workbook.worksheets.getItem("部门月度均分");
deptSheet.getRange("A1:D1").format.fill = "#305496";

await fs.mkdir(outputDir, { recursive: true });

const inspect = await workbook.inspect({
  kind: "sheet,region",
  sheetId: "部门素材类型平均分",
  range: "A1:F12",
  maxChars: 4000,
  tableMaxRows: 12,
  tableMaxCols: 8,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "部门素材类型平均分",
  range: "A1:F15",
  scale: 1,
  format: "png",
});
await fs.writeFile(path.join(outputDir, "preview.png"), new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
