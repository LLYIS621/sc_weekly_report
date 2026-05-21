#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
素材数据仪表盘生成脚本
读取 Excel 数据源，生成交互式 HTML 仪表盘
每次更新数据后运行本脚本即可重新生成仪表盘

数据源: D:/yyzx_data/素材数据源.xlsx
输出:   D:/yyzx_data/创意周会/index.html
"""

import openpyxl
import json
import calendar
from datetime import date, timedelta
import os
import re
from collections import defaultdict

# ============================================================
# 2026年中国法定节假日 & 调休
# ============================================================
# 2026年中国法定节假日 & 调休（来源：国务院办公厅通知 + chinese_calendar库）
HOLIDAYS_2026 = {
    # 元旦：1/1(周四)-1/3(周六)放假，1/4(周日)调休上班
    '2026-01-01': 'holiday', '2026-01-02': 'holiday',
    '2026-01-04': 'workday',
    # 春节：2/15(周日)-2/23(周一)放假，2/14(周六)调休上班，2/28(周六)调休上班
    '2026-02-14': 'workday',
    '2026-02-16': 'holiday', '2026-02-17': 'holiday', '2026-02-18': 'holiday',
    '2026-02-19': 'holiday', '2026-02-20': 'holiday', '2026-02-23': 'holiday',
    '2026-02-28': 'workday',
    # 清明：4/6(周一)放假（4/4-4/5为周末）
    '2026-04-06': 'holiday',
    # 劳动节：5/1(周五)-5/5(周二)放假，5/9(周六)调休上班
    '2026-05-01': 'holiday', '2026-05-04': 'holiday', '2026-05-05': 'holiday',
    '2026-05-09': 'workday',
    # 端午：6/19(周五)-6/21(周日)放假
    '2026-06-19': 'holiday',
    # 中秋：9/25(周五)-9/27(周日)放假，9/20(周日)调休上班
    '2026-09-20': 'workday', '2026-09-25': 'holiday',
    # 国庆：10/1(周四)-10/7(周三)放假，10/10(周六)调休上班
    '2026-10-01': 'holiday', '2026-10-02': 'holiday',
    '2026-10-05': 'holiday', '2026-10-06': 'holiday', '2026-10-07': 'holiday',
    '2026-10-10': 'workday',
}

HOLIDAYS_BY_YEAR = {
    2026: HOLIDAYS_2026,
}

def is_workday(d):
    ds = d.strftime('%Y-%m-%d')
    holiday_config = HOLIDAYS_BY_YEAR.get(d.year, {})
    if ds in holiday_config:
        return holiday_config[ds] == 'workday'
    return d.weekday() < 5

def count_workdays(start_date, end_date):
    cnt = 0
    cur = start_date
    while cur <= end_date:
        if is_workday(cur):
            cnt += 1
        cur += timedelta(days=1)
    return cnt

def get_month_range(ym_str):
    y, m = int(ym_str.split('-')[0]), int(ym_str.split('-')[1])
    first = date(y, m, 1)
    last_day = calendar.monthrange(y, m)[1]
    last = date(y, m, last_day)
    return first, last

# ============================================================
# 路径设置
# ============================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPT_DIR)
EXCEL_PATH = os.path.join(BASE_DIR, '素材数据源.xlsx')
OUTPUT_PATH = os.path.join(SCRIPT_DIR, 'index.html')
TEMPLATE_PATH = os.path.join(SCRIPT_DIR, 'template.html')


def main():
    # ============================================================
    # 读取 Excel
    # ============================================================
    print('读取 Excel 数据...')

    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)

    # --- 读取素材数据 ---
    ws_source = wb['素材数据']
    source_headers = []
    source_rows = []
    for i, row in enumerate(ws_source.iter_rows(values_only=True)):
        if i == 0:
            source_headers = list(row)
        else:
            row_data = dict(zip(source_headers, row))
            source_rows.append(row_data)
    print(f'  主数据: {len(source_rows)} 条')

    # --- 人力成本（用同一wb读取，人均人力成本自行计算） ---
    ws_labor_cost = wb['投入产出']
    labor_cost_headers = []
    labor_cost_rows = []
    for i, row in enumerate(ws_labor_cost.iter_rows(values_only=True)):
        if i == 0:
            labor_cost_headers = list(row)
        else:
            row_data = dict(zip(labor_cost_headers, row))
            row_data['ROI'] = row_data.get('ROI', 0) or 0
            # 人均人力成本 = (人力+工位) / 总人力
            total_headcount = row_data.get('总人力', 0) or 0
            total_labor_cost = row_data.get('人力+工位', 0) or 0
            row_data['人均人力成本'] = total_labor_cost / total_headcount if total_headcount > 0 else 0
            labor_cost_rows.append(row_data)
    print(f'  投入产出: {len(labor_cost_rows)} 条')


    # --- 月度人力 ---
    ws_monthly_manpower = wb['月度人力']
    monthly_manpower_headers = []
    monthly_manpower_rows = []
    for i, row in enumerate(ws_monthly_manpower.iter_rows(values_only=True)):
        if i == 0:
            monthly_manpower_headers = list(row)
        else:
            row_data = dict(zip(monthly_manpower_headers, row))
            monthly_manpower_rows.append(row_data)
    print(f'  月度人力: {len(monthly_manpower_rows)} 条')

    # --- 周度人力 ---
    ws_weekly_manpower = wb['周度人力']
    weekly_manpower_headers = []
    weekly_manpower_rows = []
    for i, row in enumerate(ws_weekly_manpower.iter_rows(values_only=True)):
        if i == 0:
            weekly_manpower_headers = list(row)
        else:
            row_data = dict(zip(weekly_manpower_headers, row))
            weekly_manpower_rows.append(row_data)
    print(f'  周度人力: {len(weekly_manpower_rows)} 条')

    # wb 不在此处 close，后面 save 时会自动处理

    # ============================================================
    # 获取近四月 & 近四周
    # ============================================================
    all_months = sorted(set(row['统计年月'] for row in source_rows if row.get('统计年月')))

    # 周度人力 Sheet 允许保留更长历史；仪表盘展示时仍只截取最近四周
    all_week_keys = set(row.get('周数') for row in weekly_manpower_rows if row.get('周数'))
    # 按“年份 + 周数”排序，兼容 26W1 / 2026W1 / 2026-W1 等格式
    def sort_week_key(w):
        if not w:
            return (0, 0)
        match = re.search(r'(\d{2,4})\D*W(\d{1,2})', str(w).upper())
        if not match:
            return (0, 0)
        year = int(match.group(1))
        week = int(match.group(2))
        if year < 100:
            year += 2000
        return (year, week)

    def get_week_end_date(w):
        year, week = sort_week_key(w)
        if year == 0 or week == 0:
            return None
        try:
            return date.fromisocalendar(year, week, 7)
        except ValueError:
            return None

    all_week_periods = sorted(list(all_week_keys), key=sort_week_key)

    RECENT_MONTHS = all_months[-4:] if len(all_months) >= 4 else all_months
    RECENT_WEEKS = all_week_periods[-4:] if len(all_week_periods) >= 4 else all_week_periods
    latest_week_end_date = get_week_end_date(RECENT_WEEKS[-1]) if RECENT_WEEKS else None
    if latest_week_end_date:
        print(f'  月度工作日截止日: {latest_week_end_date}')
    print(f'  近四月: {RECENT_MONTHS}')
    print(f'  近四周: {RECENT_WEEKS}')

    # ============================================================
    # 构建查询索引
    # ============================================================
    print('构建查询索引...')

    ROWS_BY_MONTH = defaultdict(list)
    ROWS_BY_WEEK = defaultdict(list)
    ROWS_BY_MONTH_DEPT = defaultdict(list)
    ROWS_BY_WEEK_DEPT = defaultdict(list)

    for row in source_rows:
        month_key = row.get('统计年月')
        week_key = row.get('统计周数')
        department_name = row.get('制作部门')
        if month_key:
            ROWS_BY_MONTH[month_key].append(row)
            ROWS_BY_MONTH_DEPT[(month_key, department_name)].append(row)
        if week_key:
            ROWS_BY_WEEK[week_key].append(row)
            ROWS_BY_WEEK_DEPT[(week_key, department_name)].append(row)

    MONTHLY_MANPOWER_INDEX = {
        (row.get('年月'), row.get('部门'), row.get('岗位'), row.get('业务单元')): row
        for row in monthly_manpower_rows
    }
    WEEKLY_MANPOWER_INDEX = {
        (row.get('周数'), row.get('部门'), row.get('岗位'), row.get('业务单元')): row
        for row in weekly_manpower_rows
    }
    LABOR_COST_INDEX = {
        (row.get('年月'), row.get('制作部门')): row
        for row in labor_cost_rows
    }

    print('  查询索引构建完成')

    # 单素材人力成本 — 各部门主管人力偏移量（硬编码）
    # key: 模块名, value: {部门: 偏移量}
    LABOR_COST_OFFSET = {
        '图片': {'效果设计部': 0.5, '品牌设计部': 0.5, '合肥创意部': 0, '内容二部': 0.25},
        '混剪': {'效果设计部': 0.5, '品牌设计部': 0, '合肥创意部': 0, '内容二部': 0.25},
    }

    # ============================================================
    # 辅助函数
    # ============================================================
    def filter_source_rows(business_units=None, posts=None, biz_source=None,
                           exclude_data_sources=None, months=None, weeks=None, depts=None):
        candidates = None
        if months:
            candidates = []
            for month_key in months:
                if depts:
                    for dept in depts:
                        candidates.extend(ROWS_BY_MONTH_DEPT.get((month_key, dept), []))
                else:
                    candidates.extend(ROWS_BY_MONTH.get(month_key, []))
        elif weeks:
            candidates = []
            for week_key in weeks:
                if depts:
                    for dept in depts:
                        candidates.extend(ROWS_BY_WEEK_DEPT.get((week_key, dept), []))
                else:
                    candidates.extend(ROWS_BY_WEEK.get(week_key, []))
        else:
            candidates = source_rows

        filtered_rows = []
        for row in candidates:
            if exclude_data_sources and row.get('数据来源') in exclude_data_sources:
                continue
            if depts and row.get('制作部门') not in depts:
                continue
            if business_units and row.get('业务单元') not in business_units:
                continue
            if posts and row.get('岗位') not in posts:
                continue
            if biz_source and row.get('业务来源') != biz_source:
                continue
            if months and row.get('统计年月') not in months:
                continue
            if weeks and row.get('统计周数') not in weeks:
                continue
            filtered_rows.append(row)
        return filtered_rows

    def get_manpower_value(manpower_rows, period_key, dept, post, business_unit, field='产出用'):
        """查人力数，按月或周查找（修复：现在正确使用key_val匹配年月或周数）"""
        index = MONTHLY_MANPOWER_INDEX if manpower_rows is monthly_manpower_rows else WEEKLY_MANPOWER_INDEX
        row = index.get((period_key, dept, post, business_unit))
        if not row:
            return 0
        value = row.get(field)
        return value if value is not None else 0

    def get_labor_cost_per_capita(month_key, dept):
        """查某月某部门的人均人力成本"""
        row = LABOR_COST_INDEX.get((month_key, dept))
        if not row:
            return 0
        value = row.get('人均人力成本')
        return value if value is not None else 0

    def calc_single_labor_cost(total_output, dept_manpower_list):
        """
        计算单素材人力成本
        total_output: 总产出
        dept_manpower_list: [(产出用人力, 偏移量, 人均人力成本), ...]
        公式: Σ(产出用人力 + 偏移量) × 人均人力成本 ÷ 总产出
        """
        if total_output == 0:
            return 0
        total_cost = sum((mp + offset) * cost for mp, offset, cost in dept_manpower_list)
        return total_cost / total_output


    def sum_output(rows, output_field):
        return sum((row.get(output_field, 0) or 0) for row in rows)

    def calculate_metrics(rows, workdays, manpower_output, manpower_workload, output_field='产出数', debug_info=None,
                          efficiency_output_field=None):
        total_output = sum_output(rows, output_field)
        efficiency_output = sum_output(rows, efficiency_output_field or output_field)
        total_workload = sum((r.get('周报工作量', 0) or 0) for r in rows)

        if debug_info:
            print(f"[{debug_info['type']}] {debug_info['module']} | {debug_info['dept']} | {debug_info['period']}")
            print(f"  总产出={total_output:.1f}, 总工时={total_workload:.1f}, 工作日={workdays}")
            print(f"  产出用={manpower_output:.1f}, 工作量用={manpower_workload:.1f}")

        if workdays == 0 or manpower_output == 0:
            avg_daily_output = 0
        else:
            avg_daily_output = total_output / workdays / manpower_output

        if workdays == 0 or manpower_workload == 0:
            avg_daily_workload = 0
        else:
            avg_daily_workload = total_workload / workdays / manpower_workload

        saturation = avg_daily_workload / 7 if avg_daily_workload else 0

        if efficiency_output == 0:
            single_time = 0
        else:
            single_time = total_workload * 60 / efficiency_output

        if debug_info:
            print(f"  => 人均日均产出={avg_daily_output:.1f} (公式: {total_output:.1f}/{workdays}/{manpower_output:.1f})")
            print(f"  => 人均日均工时={avg_daily_workload:.1f} (公式: {total_workload:.1f}/{workdays}/{manpower_workload:.1f})")
            print(f"  => 饱和度={saturation:.1f} (公式: {avg_daily_workload:.1f}/7)")
            if efficiency_output > 0:
                print(f"  => 单素材耗时={single_time:.1f} (公式: {total_workload:.1f}*60/{efficiency_output:.1f})")
            print()

        return {
            'total_output': round(total_output, 2),
            'avg_daily_output': round(avg_daily_output, 4),
            'avg_daily_workload': round(avg_daily_workload, 4),
            'saturation': round(saturation, 4),
            'single_time': round(single_time, 2),
        }


    def calculate_efficiency_metrics(rows, workdays, manpower_workload, output_field='产出数'):
        """仅计算效率指标（饱和度、人均日均工时、单素材耗时），用于排除实习生后重算"""
        total_output = sum_output(rows, output_field)
        total_workload = sum((r.get('周报工作量', 0) or 0) for r in rows)

        if workdays == 0 or manpower_workload == 0:
            avg_daily_workload = 0
        else:
            avg_daily_workload = total_workload / workdays / manpower_workload

        saturation = avg_daily_workload / 7 if avg_daily_workload else 0

        if total_output == 0:
            single_time = 0
        else:
            single_time = total_workload * 60 / total_output

        return {
            'avg_daily_workload': round(avg_daily_workload, 4),
            'saturation': round(saturation, 4),
            'single_time': round(single_time, 2),
        }

    def exclude_intern_rows(rows):
        """排除是否实习生=1的记录。"""
        return [row for row in rows if row.get('是否实习生') != 1]

    def count_distinct_projects(rows):
        """按修正所属中心+修正需求部门+修正产品去重，计算项目数"""
        projects = set()
        for r in rows:
            center = (r.get('修正所属中心') or '').strip()
            dept_req = (r.get('修正需求部门') or '').strip()
            product = (r.get('修正产品') or '').strip()
            projects.add((center, dept_req, product))
        # 过滤掉三个字段都为空的无效记录
        valid = {p for p in projects if any(p)}
        return len(valid)

    # 计算每月工作日
    month_workdays = {}
    for month_key in RECENT_MONTHS:
        first, last = get_month_range(month_key)
        if latest_week_end_date:
            last = min(last, latest_week_end_date)
        month_workdays[month_key] = count_workdays(first, last) if first <= last else 0

    # 计算每周工作日
    week_workdays = {}
    for w in RECENT_WEEKS:
        dates_in_week = set()
        for row in source_rows:
            if row.get('统计周数') == w and row.get('统计日期'):
                ds = row['统计日期']
                if isinstance(ds, str):
                    try:
                        dates_in_week.add(date.fromisoformat(ds))
                    except:
                        pass
                elif hasattr(ds, 'year'):
                    dates_in_week.add(date(ds.year, ds.month, ds.day))
        if dates_in_week:
            week_workdays[w] = count_workdays(min(dates_in_week), max(dates_in_week))
        else:
            week_workdays[w] = 5

    print(f'  每月工作日: {month_workdays}')
    print(f'  每周工作日: {week_workdays}')

    # ============================================================
    # 模块定义
    # ============================================================
    # `MODULES` 是新增模块时最主要的入口，推荐优先在这里描述差异，不去主流程里加分支。
    # 字段约定：
    # - `name`: 仪表盘上展示的模块名称，也是某些专项规则（如单素材人力成本偏移量）的关联键。
    # - `filters`: 定义源数据怎么筛。`business_units` / `posts` / `biz_source` 都是等值筛选；
    #   `exclude_data_sources` 用来显式声明哪些数据来源要排除。
    # - `manpower`: 定义人力口径。月度/周度可能走不同业务单元，`department_position_map`
    #   用来把“部门 -> 岗位”对齐到人力表；`department_scope=None` 表示按产出自动排序部门。
    # - `metrics`: 定义指标规则。`output_field` 决定产出取哪一列；
    #   `enable_project_count` / `exclude_intern_efficiency` / `show_total` / `hidden`
    #   都是显式规则，避免靠模块名或字段名做隐式推断。
    # 新增模块时的建议顺序：
    # 1. 先确认要筛哪些源数据，补 `filters`
    # 2. 再确认人力表该怎么对齐，补 `manpower`
    # 3. 最后确认产出字段、项目数、总计展示等规则，补 `metrics`
    MODULES = [
        {
            'name': '图片',
            'filters': {
                'business_units': ['图片'],
                'posts': ['设计'],
                'biz_source': None,
                'exclude_data_sources': ['额外补充'],
            },
            'manpower': {
                'monthly_business_unit': '图片',
                'weekly_business_unit': '图片',
                'department_scope': None,
                'department_position_map': {'效果设计部': '设计', '品牌设计部': '设计',
                                            '合肥创意部': '设计', '内容二部': '设计'},
            },
            'metrics': {
                'output_field': '产出数',
                'enable_project_count': False,
                'exclude_intern_efficiency': True,
                'show_total': True,
                'hidden': False,
            },
        },
        {
            'name': '混剪',
            'filters': {
                'business_units': ['混剪'],
                'posts': ['剪辑'],
                'biz_source': None,
                'exclude_data_sources': ['额外补充'],
            },
            'manpower': {
                'monthly_business_unit': '混剪',
                'weekly_business_unit': '混剪',
                'department_scope': None,
                'department_position_map': {'效果设计部': '剪辑', '品牌设计部': '剪辑',
                                            '合肥创意部': '剪辑', '内容二部': '剪辑'},
            },
            'metrics': {
                'output_field': '产出数',
                'enable_project_count': False,
                'exclude_intern_efficiency': True,
                'show_total': True,
                'hidden': False,
            },
        },
        {
            'name': '内容团队-编剧',
            'filters': {
                'business_units': ['混剪', '内容部常规'],
                'posts': ['编剧'],
                'biz_source': '广告投流',
                'exclude_data_sources': ['额外补充'],
            },
            'manpower': {
                'monthly_business_unit': '拍摄',
                'weekly_business_unit': '拍摄',
                'department_scope': ['品牌设计部', '内容二部'],
                'department_position_map': {'品牌设计部': '编剧', '内容二部': '编剧'},
            },
            'metrics': {
                'output_field': '写脚本数',
                'alternate_output_field': '产出数',
                'efficiency_output_field': '产出数',
                'enable_project_count': True,
                'exclude_intern_efficiency': False,
                'show_total': False,
                'hidden': False,
            },
        },
        {
            'name': '内容团队-导演',
            'filters': {
                'business_units': ['内容部常规'],
                'posts': ['导演'],
                'biz_source': '广告投流',
                'exclude_data_sources': ['额外补充'],
            },
            'manpower': {
                'monthly_business_unit': '拍摄',
                'weekly_business_unit': '拍摄',
                'department_scope': ['品牌设计部', '内容二部'],
                'department_position_map': {'品牌设计部': '导演', '内容二部': '导演'},
            },
            'metrics': {
                'output_field': '产出数',
                'enable_project_count': False,
                'exclude_intern_efficiency': False,
                'show_total': False,
                'hidden': True,
            },
        },
        {
            'name': '内容团队-摄像',
            'filters': {
                'business_units': ['内容部常规'],
                'posts': ['摄像'],
                'biz_source': '广告投流',
                'exclude_data_sources': ['额外补充'],
            },
            'manpower': {
                'monthly_business_unit': '拍摄',
                'weekly_business_unit': '拍摄',
                'department_scope': ['品牌设计部', '内容二部'],
                'department_position_map': {'品牌设计部': '摄像', '内容二部': '摄像'},
            },
            'metrics': {
                'output_field': '产出数',
                'enable_project_count': False,
                'exclude_intern_efficiency': False,
                'show_total': False,
                'hidden': False,
            },
        },
        {
            'name': '内容团队-剪辑',
            'filters': {
                'business_units': ['内容部常规'],
                'posts': ['剪辑'],
                'biz_source': '广告投流',
                'exclude_data_sources': ['额外补充'],
            },
            'manpower': {
                'monthly_business_unit': '拍摄',
                'weekly_business_unit': '拍摄',
                'department_scope': ['品牌设计部', '内容二部'],
                'department_position_map': {'品牌设计部': '剪辑', '内容二部': '剪辑'},
            },
            'metrics': {
                'output_field': '产出数',
                'enable_project_count': False,
                'exclude_intern_efficiency': False,
                'show_total': False,
                'hidden': False,
            },
        },
    ]

    # 这一组 helper 的作用是把“配置长什么样”和“业务流程怎么读配置”解耦。
    # 后面如果 MODULES 再调整结构，优先改这些函数，而不是满文件搜字段名。
    def get_module_filter_options(module_config):
        return module_config['filters']

    def get_module_manpower_options(module_config):
        return module_config['manpower']

    def get_module_metric_options(module_config):
        return module_config['metrics']

    def get_module_name(module_config):
        return module_config['name']

    def should_hide_module(module_config):
        return get_module_metric_options(module_config).get('hidden', False)

    def should_show_total(module_config):
        return get_module_metric_options(module_config).get('show_total', True)

    def get_module_output_field(module_config):
        return get_module_metric_options(module_config).get('output_field', '产出数')

    def get_module_alternate_output_field(module_config):
        return get_module_metric_options(module_config).get('alternate_output_field')

    def get_module_efficiency_output_field(module_config):
        return get_module_metric_options(module_config).get('efficiency_output_field', get_module_output_field(module_config))

    def should_enable_project_count(module_config):
        return get_module_metric_options(module_config).get('enable_project_count', False)

    def should_exclude_intern_efficiency(module_config):
        return get_module_metric_options(module_config).get('exclude_intern_efficiency', False)

    def get_module_business_units(module_config):
        return get_module_filter_options(module_config)['business_units']

    def get_module_posts(module_config):
        return get_module_filter_options(module_config)['posts']

    def get_module_business_source(module_config):
        return get_module_filter_options(module_config)['biz_source']

    def get_module_excluded_data_sources(module_config):
        return get_module_filter_options(module_config).get('exclude_data_sources')

    def get_department_scope(module_config):
        return get_module_manpower_options(module_config).get('department_scope')

    def get_department_position_map(module_config):
        return get_module_manpower_options(module_config)['department_position_map']

    def get_monthly_manpower_business_unit(module_config):
        return get_module_manpower_options(module_config)['monthly_business_unit']

    def get_weekly_manpower_business_unit(module_config):
        return get_module_manpower_options(module_config)['weekly_business_unit']

    def build_module_runtime_options(module_config):
        """把主流程反复要用的模块配置整理成一份已解释好的运行参数。"""
        return {
            'name': get_module_name(module_config),
            'show_total': should_show_total(module_config),
            'department_scope': get_department_scope(module_config),
            'department_position_map': get_department_position_map(module_config),
            'monthly_manpower_business_unit': get_monthly_manpower_business_unit(module_config),
            'weekly_manpower_business_unit': get_weekly_manpower_business_unit(module_config),
            'output_field': get_module_output_field(module_config),
            'alternate_output_field': get_module_alternate_output_field(module_config),
            'efficiency_output_field': get_module_efficiency_output_field(module_config),
            'enable_project_count': should_enable_project_count(module_config),
            'exclude_intern_efficiency': should_exclude_intern_efficiency(module_config),
            'business_units': get_module_business_units(module_config),
            'posts': get_module_posts(module_config),
            'business_source': get_module_business_source(module_config),
            'exclude_data_sources': get_module_excluded_data_sources(module_config),
        }

    def get_sorted_departments(module_options):
        """部门排序规则保持不变，只是单独收成函数，方便后面理解和替换。"""
        department_scope = module_options['department_scope']
        department_position_map = module_options['department_position_map']

        if department_scope is not None:
            return department_scope

        dept_output = {}
        for dept in department_position_map:
            total = 0
            for month_key in RECENT_MONTHS:
                rows = filter_source_rows(
                    business_units=module_options['business_units'],
                    posts=module_options['posts'],
                    biz_source=module_options['business_source'],
                    exclude_data_sources=module_options['exclude_data_sources'],
                    months=[month_key],
                    depts=[dept]
                )
                total += sum_output(rows, module_options['output_field'])
            dept_output[dept] = total

        return sorted(dept_output.keys(), key=lambda d: dept_output[d], reverse=True)

    def apply_efficiency_adjustments(metrics, rows, workday_count, workload_manpower, module_options):
        """效率指标是否排除实习生，完全由模块配置控制。"""
        if not module_options['exclude_intern_efficiency'] or not rows:
            return metrics

        non_intern_rows = exclude_intern_rows(rows)
        if not non_intern_rows:
            return metrics

        efficiency_metrics = calculate_efficiency_metrics(
            non_intern_rows,
            workday_count,
            workload_manpower,
            module_options['efficiency_output_field']
        )
        metrics['avg_daily_workload'] = efficiency_metrics['avg_daily_workload']
        metrics['saturation'] = efficiency_metrics['saturation']
        metrics['single_time'] = efficiency_metrics['single_time']
        return metrics

    def attach_project_metrics(metrics, rows, output_manpower, module_options):
        """项目数是显式配置，不再通过 output_field 之类的隐式规则推断。"""
        if not module_options['enable_project_count']:
            return metrics

        project_count = count_distinct_projects(rows)
        metrics['project_count'] = project_count
        metrics['project_per_capita'] = round(project_count / output_manpower, 1) if output_manpower > 0 else 0
        return metrics

    def attach_alternate_output_metrics(metrics, rows, workday_count, output_manpower, module_options):
        """编剧产出区口径切换：对接脚本数直接使用产出数列。"""
        alternate_output_field = module_options.get('alternate_output_field')
        if not alternate_output_field:
            return metrics

        alternate_total_output = sum_output(rows, alternate_output_field)
        if workday_count == 0 or output_manpower == 0:
            alternate_avg_daily_output = 0
        else:
            alternate_avg_daily_output = alternate_total_output / workday_count / output_manpower

        metrics['handoff_total_output'] = round(alternate_total_output, 2)
        metrics['handoff_avg_daily_output'] = round(alternate_avg_daily_output, 4)
        return metrics

    def attach_total_project_metrics(metrics, detail_metrics, period_key, sorted_depts, total_output_manpower, module_options):
        """总计项目数来自各部门项目数汇总，避免月度/周度重复写同一段逻辑。"""
        if not module_options['enable_project_count']:
            return metrics

        total_project_count = sum(detail_metrics[dept][period_key].get('project_count', 0) for dept in sorted_depts)
        metrics['project_count'] = total_project_count
        metrics['project_per_capita'] = round(total_project_count / total_output_manpower, 1) if total_output_manpower > 0 else 0
        return metrics

    def calculate_monthly_metrics(module_options, module_name, sorted_depts):
        department_position_map = module_options['department_position_map']
        monthly_manpower_business_unit = module_options['monthly_manpower_business_unit']

        dept_month_metrics = {}
        for dept in sorted_depts:
            post = department_position_map[dept]
            dept_month_metrics[dept] = {}
            for month_key in RECENT_MONTHS:
                rows = filter_source_rows(
                    business_units=module_options['business_units'],
                    posts=module_options['posts'],
                    biz_source=module_options['business_source'],
                    exclude_data_sources=module_options['exclude_data_sources'],
                    months=[month_key],
                    depts=[dept]
                )
                output_manpower = get_manpower_value(monthly_manpower_rows, month_key, dept, post,
                                                     monthly_manpower_business_unit, '产出用')
                workload_manpower = get_manpower_value(monthly_manpower_rows, month_key, dept, post,
                                                       monthly_manpower_business_unit, '工作量用')
                workday_count = month_workdays.get(month_key, 22)
                debug_info = {'type': '月度', 'module': module_name, 'dept': dept, 'period': month_key}
                metrics = calculate_metrics(rows, workday_count, output_manpower, workload_manpower,
                                            module_options['output_field'], debug_info,
                                            module_options['efficiency_output_field'])
                metrics = apply_efficiency_adjustments(metrics, rows, workday_count, workload_manpower, module_options)
                metrics = attach_project_metrics(metrics, rows, output_manpower, module_options)
                metrics = attach_alternate_output_metrics(metrics, rows, workday_count, output_manpower, module_options)
                dept_month_metrics[dept][month_key] = metrics

        total_month_metrics = {}
        valid_depts = list(department_position_map.keys())
        for month_key in RECENT_MONTHS:
            rows = filter_source_rows(
                business_units=module_options['business_units'],
                posts=module_options['posts'],
                biz_source=module_options['business_source'],
                exclude_data_sources=module_options['exclude_data_sources'],
                months=[month_key],
                depts=valid_depts
            )
            total_output_manpower = sum(
                get_manpower_value(monthly_manpower_rows, month_key, dept, department_position_map[dept],
                                   monthly_manpower_business_unit, '产出用')
                for dept in valid_depts
            )
            total_workload_manpower = sum(
                get_manpower_value(monthly_manpower_rows, month_key, dept, department_position_map[dept],
                                   monthly_manpower_business_unit, '工作量用')
                for dept in valid_depts
            )
            workday_count = month_workdays.get(month_key, 22)
            debug_info = {'type': '月度-总计', 'module': module_name, 'dept': '总计', 'period': month_key}
            metrics = calculate_metrics(rows, workday_count, total_output_manpower, total_workload_manpower,
                                        module_options['output_field'], debug_info,
                                        module_options['efficiency_output_field'])
            metrics = apply_efficiency_adjustments(metrics, rows, workday_count, total_workload_manpower, module_options)
            metrics = attach_total_project_metrics(
                metrics,
                dept_month_metrics,
                month_key,
                sorted_depts,
                total_output_manpower,
                module_options
            )
            metrics = attach_alternate_output_metrics(metrics, rows, workday_count, total_output_manpower, module_options)
            total_month_metrics[month_key] = metrics

        if module_name in LABOR_COST_OFFSET:
            offsets = LABOR_COST_OFFSET[module_name]
            for dept in sorted_depts:
                offset = offsets.get(dept, 0)
                post = department_position_map[dept]
                for month_key in RECENT_MONTHS:
                    output_manpower = get_manpower_value(monthly_manpower_rows, month_key, dept, post,
                                                         monthly_manpower_business_unit, '产出用')
                    cost_per_capita = get_labor_cost_per_capita(month_key, dept)
                    total_output = dept_month_metrics[dept][month_key]['total_output']
                    if total_output > 0:
                        dept_month_metrics[dept][month_key]['single_labor_cost'] = round(
                            (output_manpower + offset) * cost_per_capita / total_output, 2)
                    else:
                        dept_month_metrics[dept][month_key]['single_labor_cost'] = 0

            for month_key in RECENT_MONTHS:
                total_output = total_month_metrics[month_key]['total_output']
                manpower_items = []
                for dept in valid_depts:
                    offset = offsets.get(dept, 0)
                    post = department_position_map[dept]
                    output_manpower = get_manpower_value(monthly_manpower_rows, month_key, dept, post,
                                                         monthly_manpower_business_unit, '产出用')
                    labor_cost_per_capita = get_labor_cost_per_capita(month_key, dept)
                    manpower_items.append((output_manpower, offset, labor_cost_per_capita))
                total_month_metrics[month_key]['single_labor_cost'] = round(
                    calc_single_labor_cost(total_output, manpower_items), 2)

        return dept_month_metrics, total_month_metrics

    def calculate_weekly_metrics(module_options, module_name, sorted_depts):
        department_position_map = module_options['department_position_map']
        weekly_manpower_business_unit = module_options['weekly_manpower_business_unit']

        dept_week_metrics = {}
        for dept in sorted_depts:
            post = department_position_map[dept]
            dept_week_metrics[dept] = {}
            for week_key in RECENT_WEEKS:
                rows = filter_source_rows(
                    business_units=module_options['business_units'],
                    posts=module_options['posts'],
                    biz_source=module_options['business_source'],
                    exclude_data_sources=module_options['exclude_data_sources'],
                    weeks=[week_key],
                    depts=[dept]
                )
                output_manpower = get_manpower_value(weekly_manpower_rows, week_key, dept, post,
                                                     weekly_manpower_business_unit, '产出用')
                workload_manpower = get_manpower_value(weekly_manpower_rows, week_key, dept, post,
                                                       weekly_manpower_business_unit, '工作量用')
                workday_count = week_workdays.get(week_key, 5)
                debug_info = {'type': '周度', 'module': module_name, 'dept': dept, 'period': week_key}
                metrics = calculate_metrics(rows, workday_count, output_manpower, workload_manpower,
                                            module_options['output_field'], debug_info,
                                            module_options['efficiency_output_field'])
                metrics = apply_efficiency_adjustments(metrics, rows, workday_count, workload_manpower, module_options)
                metrics = attach_project_metrics(metrics, rows, output_manpower, module_options)
                metrics = attach_alternate_output_metrics(metrics, rows, workday_count, output_manpower, module_options)
                dept_week_metrics[dept][week_key] = metrics

        total_week_metrics = {}
        valid_depts = list(department_position_map.keys())
        for week_key in RECENT_WEEKS:
            rows = filter_source_rows(
                business_units=module_options['business_units'],
                posts=module_options['posts'],
                biz_source=module_options['business_source'],
                exclude_data_sources=module_options['exclude_data_sources'],
                weeks=[week_key],
                depts=valid_depts
            )
            total_output_manpower = sum(
                get_manpower_value(weekly_manpower_rows, week_key, dept, department_position_map[dept],
                                   weekly_manpower_business_unit, '产出用')
                for dept in valid_depts
            )
            total_workload_manpower = sum(
                get_manpower_value(weekly_manpower_rows, week_key, dept, department_position_map[dept],
                                   weekly_manpower_business_unit, '工作量用')
                for dept in valid_depts
            )
            workday_count = week_workdays.get(week_key, 5)
            debug_info = {'type': '周度-总计', 'module': module_name, 'dept': '总计', 'period': week_key}
            metrics = calculate_metrics(rows, workday_count, total_output_manpower, total_workload_manpower,
                                        module_options['output_field'], debug_info,
                                        module_options['efficiency_output_field'])
            metrics = apply_efficiency_adjustments(metrics, rows, workday_count, total_workload_manpower, module_options)
            metrics = attach_total_project_metrics(
                metrics,
                dept_week_metrics,
                week_key,
                sorted_depts,
                total_output_manpower,
                module_options
            )
            metrics = attach_alternate_output_metrics(metrics, rows, workday_count, total_output_manpower, module_options)
            total_week_metrics[week_key] = metrics

        return dept_week_metrics, total_week_metrics

    def build_structure_view_data(module_options, periods, period_key, output_field=None):
        """结构分析复用同一套筛选规则，只是关注占比和波动而不是效率指标。"""
        structure_output_field = output_field or module_options['output_field']
        last_period = periods[-1]
        all_depts = ['全部'] + list(module_options['department_position_map'].keys())
        view_result = {}

        for dept_key in all_depts:
            rows_latest = filter_source_rows(
                business_units=module_options['business_units'],
                posts=module_options['posts'],
                biz_source=module_options['business_source'],
                exclude_data_sources=module_options['exclude_data_sources'],
                depts=None if dept_key == '全部' else [dept_key],
                **{period_key: [last_period]}
            )

            center_map = {}
            for row in rows_latest:
                center = (row.get('修正所属中心') or '未知').strip()
                dept_req = (row.get('修正需求部门') or '未知').strip()
                out = row.get(structure_output_field, 0) or 0

                if center in EXPAND_CENTERS:
                    item_key = center + '|' + dept_req
                    if item_key not in center_map:
                        center_map[item_key] = {'label': dept_req, 'group': center, 'output': 0, 'expanded': True}
                    center_map[item_key]['output'] += out
                else:
                    if center not in center_map:
                        center_map[center] = {'label': center, 'group': center, 'output': 0, 'expanded': False}
                    center_map[center]['output'] += out

            share_list = sorted(center_map.values(), key=lambda x: x['output'], reverse=True)
            total_output_share = sum(item['output'] for item in share_list)

            if len(periods) >= 2:
                prev_period = periods[-2]
                rows_prev = filter_source_rows(
                    business_units=module_options['business_units'],
                    posts=module_options['posts'],
                    biz_source=module_options['business_source'],
                    exclude_data_sources=module_options['exclude_data_sources'],
                    depts=None if dept_key == '全部' else [dept_key],
                    **{period_key: [prev_period]}
                )

                def build_project_map(rows):
                    project_map = {}
                    for row in rows:
                        center = (row.get('修正所属中心') or '').strip()
                        dept_req = (row.get('修正需求部门') or '').strip()
                        product = (row.get('修正产品') or '').strip()
                        out = row.get(structure_output_field, 0) or 0
                        project_key = f"{center} / {dept_req} / {product}" if center and dept_req and product else '未知项目'
                        project_map[project_key] = project_map.get(project_key, 0) + out
                    return project_map

                prev_map = build_project_map(rows_prev)
                curr_map = build_project_map(rows_latest)

                all_keys = set(list(prev_map.keys()) + list(curr_map.keys()))
                changes = []
                for project_key in all_keys:
                    prev_value = prev_map.get(project_key, 0)
                    curr_value = curr_map.get(project_key, 0)
                    diff = curr_value - prev_value
                    pct = round(diff / prev_value * 100, 1) if prev_value > 0 else None
                    changes.append({
                        'project': project_key,
                        'prev': prev_value,
                        'curr': curr_value,
                        'diff': diff,
                        'pct': pct,
                    })

                increases = [change for change in changes if change['diff'] > 0]
                decreases = [change for change in changes if change['diff'] < 0]
                increases.sort(key=lambda x: x['diff'], reverse=True)
                decreases.sort(key=lambda x: x['diff'])
                top_up = increases[:3]
                top_down = decreases[:3]
            else:
                top_up = []
                top_down = []

            view_result[dept_key] = {
                'share_list': share_list,
                'total_output_share': total_output_share,
                'top_up': top_up,
                'top_down': top_down,
            }

        return view_result


    def build_efficiency_view_data(module_options, periods, period_key):
        output_field = module_options['efficiency_output_field']
        exclude_intern = module_options['exclude_intern_efficiency']
        sorted_depts = get_sorted_departments(module_options)
        latest_period = periods[-1] if periods else None
        prev_period = periods[-2] if len(periods) >= 2 else None
        workday_map = month_workdays if period_key == 'months' else week_workdays
        view_result = {}

        for dept_key in ['全部'] + sorted_depts:
            rows_latest = filter_source_rows(
                business_units=module_options['business_units'],
                posts=module_options['posts'],
                biz_source=module_options['business_source'],
                exclude_data_sources=module_options['exclude_data_sources'],
                depts=None if dept_key == '全部' else [dept_key],
                **{period_key: [latest_period]} if latest_period else {}
            )
            rows_latest = exclude_intern_rows(rows_latest) if exclude_intern else rows_latest

            def build_demand_dept_time(rows):
                demand_map = {}
                for row in rows:
                    demand_dept = (row.get('修正需求部门') or '未知').strip() or '未知'
                    output_value = row.get(output_field, 0) or 0
                    workload_value = row.get('周报工作量', 0) or 0
                    if demand_dept not in demand_map:
                        demand_map[demand_dept] = {'label': demand_dept, 'output': 0, 'workload': 0}
                    demand_map[demand_dept]['output'] += output_value
                    demand_map[demand_dept]['workload'] += workload_value

                result = []
                for item in demand_map.values():
                    single_time = item['workload'] * 60 / item['output'] if item['output'] > 0 else 0
                    result.append({
                        'label': item['label'],
                        'single_time': round(single_time, 2),
                        'output': round(item['output'], 2),
                    })
                result.sort(key=lambda x: x['single_time'], reverse=True)
                return result

            def build_project_time_map(rows):
                project_map = {}
                for row in rows:
                    center = (row.get('修正所属中心') or '').strip()
                    demand_dept = (row.get('修正需求部门') or '').strip()
                    product = (row.get('修正产品') or '').strip()
                    project_key = f"{center} / {demand_dept} / {product}" if center and demand_dept and product else '未知项目'
                    output_value = row.get(output_field, 0) or 0
                    workload_value = row.get('周报工作量', 0) or 0
                    if project_key not in project_map:
                        project_map[project_key] = {'project': project_key, 'output': 0, 'workload': 0}
                    project_map[project_key]['output'] += output_value
                    project_map[project_key]['workload'] += workload_value

                result = {}
                for project_key, item in project_map.items():
                    if item['output'] <= 0:
                        continue
                    result[project_key] = {
                        'project': project_key,
                        'output': round(item['output'], 2),
                        'single_time': round(item['workload'] * 60 / item['output'], 2),
                    }
                return result

            total_latest_output = sum(row.get(output_field, 0) or 0 for row in rows_latest)
            total_latest_workload = sum(row.get('周报工作量', 0) or 0 for row in rows_latest)
            overall_curr_single_time = round(total_latest_workload * 60 / total_latest_output, 2) if total_latest_output > 0 else 0
            demand_dept_times = build_demand_dept_time(rows_latest)
            for item in demand_dept_times:
                output_share = item['output'] / total_latest_output * 100 if total_latest_output > 0 else 0
                item['output_share'] = round(output_share, 1)
            latest_project_map = build_project_time_map(rows_latest)
            ranked_projects = sorted(latest_project_map.values(), key=lambda x: x['single_time'], reverse=True)
            top_high = ranked_projects[:5]
            top_low = sorted(ranked_projects, key=lambda x: x['single_time'])[:5]

            if prev_period:
                rows_prev = filter_source_rows(
                    business_units=module_options['business_units'],
                    posts=module_options['posts'],
                    biz_source=module_options['business_source'],
                    exclude_data_sources=module_options['exclude_data_sources'],
                    depts=None if dept_key == '全部' else [dept_key],
                    **{period_key: [prev_period]}
                )
                rows_prev = exclude_intern_rows(rows_prev) if exclude_intern else rows_prev
                total_prev_output = sum(row.get(output_field, 0) or 0 for row in rows_prev)
                total_prev_workload = sum(row.get('周报工作量', 0) or 0 for row in rows_prev)
                overall_prev_single_time = round(total_prev_workload * 60 / total_prev_output, 2) if total_prev_output > 0 else 0
                prev_project_map = build_project_time_map(rows_prev)

                prev_demand_dept_times = {item['label']: item for item in build_demand_dept_time(rows_prev)}
                curr_demand_dept_times = {item['label']: item for item in demand_dept_times}
                dept_impact_up = []
                dept_impact_down = []
                all_demand_depts = set(prev_demand_dept_times.keys()) | set(curr_demand_dept_times.keys())
                for demand_dept in all_demand_depts:
                    prev_info = prev_demand_dept_times.get(demand_dept, {'single_time': 0, 'output': 0})
                    curr_info = curr_demand_dept_times.get(demand_dept, {'single_time': 0, 'output': 0})
                    weighted_output = (prev_info['output'] + curr_info['output']) / 2
                    impact_minutes = (curr_info['single_time'] - prev_info['single_time']) * weighted_output
                    impact_item = {
                        'label': demand_dept,
                        'prev_single_time': round(prev_info['single_time'], 2),
                        'curr_single_time': round(curr_info['single_time'], 2),
                        'prev_output': round(prev_info['output'], 2),
                        'curr_output': round(curr_info['output'], 2),
                        'weighted_output': round(weighted_output, 2),
                        'impact_minutes': round(impact_minutes, 1),
                    }
                    if impact_minutes > 0:
                        dept_impact_up.append(impact_item)
                    elif impact_minutes < 0:
                        dept_impact_down.append(impact_item)
                dept_impact_up.sort(key=lambda x: x['impact_minutes'], reverse=True)
                dept_impact_down.sort(key=lambda x: x['impact_minutes'])
                top_dept_impact_up = dept_impact_up[:3]
                top_dept_impact_down = dept_impact_down[:3]

                all_project_keys = set(prev_project_map.keys()) | set(latest_project_map.keys())
                top_fluctuation = []
                project_impact_up = []
                project_impact_down = []
                for project_key in all_project_keys:
                    prev_info = prev_project_map.get(project_key)
                    latest_info = latest_project_map.get(project_key)
                    prev_single_time = prev_info['single_time'] if prev_info else 0
                    latest_single_time = latest_info['single_time'] if latest_info else 0
                    diff_value = latest_single_time - prev_single_time
                    top_fluctuation.append({
                        'project': project_key,
                        'prev': round(prev_single_time, 2),
                        'curr': round(latest_single_time, 2),
                        'diff': round(diff_value, 2),
                        'abs_diff': round(abs(diff_value), 2),
                    })
                    weighted_output = ((prev_info['output'] if prev_info else 0) + (latest_info['output'] if latest_info else 0)) / 2
                    impact_minutes = diff_value * weighted_output
                    impact_item = {
                        'project': project_key,
                        'prev_single_time': round(prev_single_time, 2),
                        'curr_single_time': round(latest_single_time, 2),
                        'prev_output': round(prev_info['output'], 2) if prev_info else 0,
                        'curr_output': round(latest_info['output'], 2) if latest_info else 0,
                        'weighted_output': round(weighted_output, 2),
                        'impact_minutes': round(impact_minutes, 1),
                    }
                    if impact_minutes > 0:
                        project_impact_up.append(impact_item)
                    elif impact_minutes < 0:
                        project_impact_down.append(impact_item)
                top_fluctuation.sort(key=lambda x: x['abs_diff'], reverse=True)
                top_fluctuation = top_fluctuation[:5]
                project_impact_up.sort(key=lambda x: x['impact_minutes'], reverse=True)
                project_impact_down.sort(key=lambda x: x['impact_minutes'])
                top_project_impact_up = project_impact_up[:3]
                top_project_impact_down = project_impact_down[:3]
            else:
                overall_prev_single_time = 0
                top_dept_impact_up = []
                top_dept_impact_down = []
                top_project_impact_up = []
                top_project_impact_down = []
                top_fluctuation = []

            view_result[dept_key] = {
                'latest_period': latest_period,
                'workdays': workday_map.get(latest_period, 0) if latest_period else 0,
                'overall_prev_single_time': overall_prev_single_time,
                'overall_curr_single_time': overall_curr_single_time,
                'demand_dept_times': demand_dept_times,
                'top_dept_impact_up': top_dept_impact_up,
                'top_dept_impact_down': top_dept_impact_down,
                'top_project_impact_up': top_project_impact_up,
                'top_project_impact_down': top_project_impact_down,
                'top_high': top_high,
                'top_low': top_low,
                'top_fluctuation': top_fluctuation,
            }

        return view_result

    # ============================================================
    # 计算所有指标数据
    # ============================================================
    print('计算指标数据...')
    dashboard_data = {'monthly': {}, 'weekly': {}}

    for mod in MODULES:
        if should_hide_module(mod):
            continue
        module_options = build_module_runtime_options(mod)
        mname = module_options['name']
        print(f'  处理模块: {mname}')
        sorted_depts = get_sorted_departments(module_options)
        dept_month_metrics, total_month_metrics = calculate_monthly_metrics(module_options, mname, sorted_depts)
        dept_week_metrics, total_week_metrics = calculate_weekly_metrics(module_options, mname, sorted_depts)

        dashboard_data['monthly'][mname] = {
            'depts': sorted_depts,
            'dept_metrics': dept_month_metrics,
            'total_metrics': total_month_metrics,
            'show_total': module_options['show_total'],
        }
        dashboard_data['weekly'][mname] = {
            'depts': sorted_depts,
            'dept_metrics': dept_week_metrics,
            'total_metrics': total_week_metrics,
            'show_total': module_options['show_total'],
        }

    print('  数据计算完成')

    # ============================================================
    # 结构分析数据计算
    # ============================================================
    print('计算结构分析数据...')

    # 展开周期所用的centers（需要拆分到需求部门的）
    EXPAND_CENTERS = {'运营中心', '创意中心'}

    structure_data = {'monthly': {}, 'weekly': {}}
    efficiency_analysis_data = {'monthly': {}, 'weekly': {}}

    for mod in MODULES:
        if should_hide_module(mod):
            continue
        module_options = build_module_runtime_options(mod)
        mname = module_options['name']
        structure_data['monthly'][mname] = {}
        structure_data['weekly'][mname] = {}
        efficiency_analysis_data['monthly'][mname] = {}
        efficiency_analysis_data['weekly'][mname] = {}

        for view in ['monthly', 'weekly']:
            periods = RECENT_MONTHS if view == 'monthly' else RECENT_WEEKS
            period_key = 'months' if view == 'monthly' else 'weeks'
            structure_data[view][mname] = build_structure_view_data(module_options, periods, period_key)
            if module_options.get('alternate_output_field'):
                structure_data[view][mname + '__handoff'] = build_structure_view_data(
                    module_options,
                    periods,
                    period_key,
                    module_options['alternate_output_field']
                )
            efficiency_analysis_data[view][mname] = build_efficiency_view_data(module_options, periods, period_key)

    print('  结构分析数据计算完成')

    # ============================================================
    # 生成 HTML
    # ============================================================
    print('生成 HTML...')

    js_data = json.dumps(dashboard_data, ensure_ascii=False)
    structure_js_data = json.dumps(structure_data, ensure_ascii=False)
    efficiency_analysis_js_data = json.dumps(efficiency_analysis_data, ensure_ascii=False)
    month_labels = json.dumps(RECENT_MONTHS)
    week_labels = json.dumps(RECENT_WEEKS)

    # 构建 ROI 数据（分部门分月）
    ROI_DEPT_ORDER = ['效果设计部','品牌设计部','合肥创意部','内容一部','内容二部']
    roi_months = sorted(set(str(row['年月']) for row in labor_cost_rows))
    roi_depts_all = set(str(row['制作部门']) for row in labor_cost_rows)
    roi_depts = [d for d in ROI_DEPT_ORDER if d in roi_depts_all]
    roi_data = {'months': roi_months, 'depts': roi_depts, 'values': {}, 'annual_roi': {}}
    # 计算各部门年度ROI = 当年总收入 / 当年总成本
    dept_income = {}
    dept_cost = {}
    for dept in roi_depts:
        dept_income[dept] = 0
        dept_cost[dept] = 0
        roi_data['values'][dept] = {}
        for row in labor_cost_rows:
            if str(row['制作部门']) == dept:
                roi_data['values'][dept][str(row['年月'])] = round(row['ROI'], 2)
                dept_income[dept] += (row.get('收入', 0) or 0)
                dept_cost[dept] += (row.get('成本', 0) or 0)
    for dept in roi_depts:
        roi_data['annual_roi'][dept] = round(dept_income[dept] / dept_cost[dept], 2) if dept_cost[dept] > 0 else 0
    roi_js_data = json.dumps(roi_data, ensure_ascii=False)

    with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
        html_template = f.read()

    html = (html_template
        .replace('{{DATA_JSON}}', js_data)
        .replace('{{STRUCTURE_DATA_JSON}}', structure_js_data)
        .replace('{{EFFICIENCY_ANALYSIS_DATA_JSON}}', efficiency_analysis_js_data)
        .replace('{{MONTH_LABELS_JSON}}', month_labels)
        .replace('{{WEEK_LABELS_JSON}}', week_labels)
        .replace('{{ROI_DATA_JSON}}', roi_js_data)
    )

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'  仪表盘已生成: {OUTPUT_PATH}')
    print('完成!')


if __name__ == '__main__':
    main()
