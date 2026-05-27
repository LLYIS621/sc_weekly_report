# 创意周会仪表盘

## 路径

- 项目目录：`D:\yyzx_data\创意周会`
- 数据源：`D:\yyzx_data\素材数据源.xlsx`
- 输出文件：`D:\yyzx_data\创意周会\index.html`

## 生成

```powershell
cd D:\yyzx_data\创意周会
python generate_dashboard.py
```

## 验证

```powershell
node verify_dashboard_runtime.js
```

`verify_dashboard_runtime.js` 用来检查页面运行时是否能正常渲染，避免出现 JS 语法没报错但页面空白的情况。
