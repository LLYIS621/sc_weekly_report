const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(ROOT, 'static', 'dashboard.js'), 'utf8');
const payloadMatch = html.match(/window\.DASHBOARD_PAYLOAD\s*=\s*([\s\S]*?)\n\s*<\/script>/);

if (!payloadMatch) {
  throw new Error('DASHBOARD_PAYLOAD not found in index.html');
}

function createElementStub(id) {
  const classes = new Set();
  return {
    id,
    innerHTML: '',
    className: '',
    style: {},
    attributes: {},
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name);
        else classes.delete(name);
        return shouldAdd;
      },
      contains(name) {
        return classes.has(name);
      },
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'id') this.id = String(value);
      if (name === 'class') this.className = String(value);
    },
    getAttribute(name) {
      if (name === 'id') return this.id;
      if (name === 'class') return this.className;
      return this.attributes[name];
    },
    appendChild(child) {
      this.children = this.children || [];
      this.children.push(child);
      if (child && child.innerHTML) {
        this.innerHTML += child.innerHTML;
      }
      return child;
    },
    insertAdjacentHTML(position, html) {
      const value = String(html);
      this.children = this.children || [];
      this.children.push(createElementStub('inserted-html'));
      if (position === 'afterbegin') {
        this.innerHTML = value + this.innerHTML;
      } else {
        this.innerHTML += value;
      }
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    scrollIntoView() {},
    getContext() {
      return {
        createLinearGradient() {
          return {
            addColorStop() {},
          };
        },
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        stroke() {},
        fillText() {},
        setLineDash() {},
        measureText(value) {
          return { width: String(value).length * 8 };
        },
      };
    },
  };
}

const elements = {
  app: createElementStub('app'),
  viewRoot: createElementStub('viewRoot'),
};

let chartCreateCount = 0;
function ChartStub() {
  chartCreateCount += 1;
  return { destroy() {} };
}
ChartStub.register = () => {};

const context = {
  console,
  window: {},
  document: {
    getElementById(id) {
      if (!elements[id]) elements[id] = createElementStub(id);
      return elements[id];
    },
    createElement(tagName) {
      return createElementStub(tagName);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  },
  Chart: ChartStub,
  ChartDataLabels: {},
  setTimeout(fn) {
    fn();
  },
  clearTimeout() {},
};

context.window = context;
vm.createContext(context);
vm.runInContext('window.DASHBOARD_PAYLOAD = ' + payloadMatch[1], context);
vm.runInContext(dashboardJs, context);

function run(expression) {
  return vm.runInContext(expression, context);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getElement(id) {
  return elements[id] || null;
}

function getChildrenCount(id) {
  const element = getElement(id);
  return element && element.children ? element.children.length : 0;
}

function getInnerHtmlLength(id) {
  const element = getElement(id);
  return element && element.innerHTML ? element.innerHTML.length : 0;
}

function quote(value) {
  return JSON.stringify(value);
}

assert(
  elements.viewRoot.innerHTML && elements.viewRoot.innerHTML.length >= 1000,
  'Overview render output is unexpectedly small: ' + getInnerHtmlLength('viewRoot')
);

const moduleNames = run('MODULE_NAMES.slice()');
assert(moduleNames.length > 0, 'No modules found in DASHBOARD_PAYLOAD');
assert(run('typeof ANOMALY_REASON_DATA === "object"'), 'Anomaly reason payload is not available');
assert(run('appState.anomalyBriefVisible') === true, 'Anomaly brief should be visible by default');

run('toggleAnomalyBrief()');
assert(run('appState.anomalyBriefVisible') === false, 'Anomaly brief toggle did not hide reasons');
run('toggleAnomalyBrief()');
assert(run('appState.anomalyBriefVisible') === true, 'Anomaly brief toggle did not show reasons again');

for (const moduleName of moduleNames) {
  run('openModuleView(' + quote(moduleName) + ')');

  for (const view of ['monthly', 'weekly']) {
    run('switchModulePeriod(' + quote(view) + ')');
    const chartContainerId = 'charts_' + moduleName + '_' + view;
    assert(
      getChildrenCount(chartContainerId) >= 2,
      moduleName + ' ' + view + ' render output is unexpectedly small: ' + getChildrenCount(chartContainerId)
    );
    assert(
      getInnerHtmlLength(chartContainerId) > 0,
      moduleName + ' ' + view + ' anomaly/chart markup did not render'
    );

    run('openStructureAnalysis(' + quote(moduleName) + ', "全部")');
    const structureContentId = 'structure_content_' + moduleName + '_' + view;
    assert(
      getChildrenCount(structureContentId) > 0 || getInnerHtmlLength(structureContentId) > 0,
      moduleName + ' ' + view + ' structure analysis did not render content'
    );

    run('openEfficiencyAnalysis(' + quote(moduleName) + ', "全部")');
    const efficiencyContentId = 'efficiency_content_' + moduleName + '_' + view;
    assert(
      getChildrenCount(efficiencyContentId) > 0 || getInnerHtmlLength(efficiencyContentId) > 0,
      moduleName + ' ' + view + ' efficiency analysis did not render content'
    );

    const depts = run('DATA[' + quote(view) + '][' + quote(moduleName) + '].depts.slice()');
    if (depts.length) {
      const firstDept = depts[0];
      run('switchStructureDept(' + quote(moduleName) + ', ' + quote(firstDept) + ')');
      assert(
        getChildrenCount(structureContentId) > 0 || getInnerHtmlLength(structureContentId) > 0,
        moduleName + ' ' + view + ' structure analysis did not render after department switch'
      );

      run('switchEfficiencyDept(' + quote(moduleName) + ', ' + quote(firstDept) + ')');
      assert(
        getChildrenCount(efficiencyContentId) > 0 || getInnerHtmlLength(efficiencyContentId) > 0,
        moduleName + ' ' + view + ' efficiency analysis did not render after department switch'
      );
    }
  }
}

const scriptModule = moduleNames.find(name => name.indexOf('编剧') >= 0);
if (scriptModule) {
  run('openModuleView(' + quote(scriptModule) + ')');
  run("switchScriptOutputMode('handoff')");
  assert(
    run("appState.scriptOutputMode") === 'handoff',
    'Script output mode did not switch to handoff'
  );
  const scriptMonthlyContainerId = 'charts_' + scriptModule + '_monthly';
  assert(
    getChildrenCount(scriptMonthlyContainerId) >= 2,
    'Script module did not render after switching output mode'
  );
  run('openStructureAnalysis(' + quote(scriptModule) + ', "全部")');
  const scriptStructureContentId = 'structure_content_' + scriptModule + '_monthly';
  assert(
    getChildrenCount(scriptStructureContentId) > 0 || getInnerHtmlLength(scriptStructureContentId) > 0,
    'Script structure analysis did not render after switching output mode'
  );
  run("switchScriptOutputMode('write')");
}

run("setMainView('business')");
assert(getElement('businessContent'), 'Business page did not create businessContent');
assert(getElement('roiChart_0'), 'ROI tab did not create the first ROI chart canvas');

run("setBusinessTab('cost')");
assert(getElement('laborCostTrendChart'), 'Cost tab did not create laborCostTrendChart');

assert(chartCreateCount > moduleNames.length * 2, 'Too few charts were created during smoke test: ' + chartCreateCount);

console.log('Dashboard runtime smoke test passed: ' + moduleNames.length + ' modules checked, ' + chartCreateCount + ' charts created');
