// DOM Elements
const resultEl = document.getElementById('result');
const exprEl = document.getElementById('expression');
const keypad = document.querySelector('.keypad');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');
const historyToggle = document.getElementById('historyToggle');
const toastEl = document.getElementById('toast');

// Calculator State
const SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const MAX_DIGITS = 15;
const HISTORY_KEY = 'smartCalcHistory';
const HISTORY_MAX = 8;
let tokens = [];        // completed numbers and operators, e.g. ['125','*','8','+']
let cur = '0';          // number currently shown / being typed
let awaiting = false;   // an operator was just pressed
let justEvaluated = false;
let error = false;
let lastExpr = '';      // expression shown after "="
let toastTimer;

// Display
function formatNumber(s) {
  if (error) return s;
  if (/e/i.test(s)) return s;
  const neg = s.startsWith('-') ? '-' : '';
  const [int, dec] = s.replace('-', '').split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return neg + grouped + (dec !== undefined ? '.' + dec : '');
}
function render(animate) {
  const text = formatNumber(cur);
  resultEl.textContent = text;
  resultEl.className = 'result' + (error ? ' error' : text.length > 16 ? ' sm' : text.length > 10 ? ' md' : '');
  if (animate) { void resultEl.offsetWidth; resultEl.classList.add('pop'); }
  exprEl.textContent = justEvaluated ? lastExpr
    : tokens.map(t => SYMBOLS[t] || formatNumber(t)).join(' ');
}
function resetAll() { tokens = []; cur = '0'; awaiting = false; justEvaluated = false; error = false; lastExpr = ''; }
function startFresh() { if (error || justEvaluated) resetAll(); }

// Input Handling
function inputDigit(d) {
  startFresh();
  if (awaiting) { cur = '0'; awaiting = false; }
  if (cur.replace(/[-.]/g, '').length >= MAX_DIGITS) return;
  cur = cur === '0' ? d : cur === '-0' ? '-' + d : cur + d;
}
function inputDecimal() {
  startFresh();
  if (awaiting) { cur = '0'; awaiting = false; }
  if (!cur.includes('.')) cur += '.';
}
function negate() {
  if (error) return;
  if (justEvaluated) { tokens = []; justEvaluated = false; lastExpr = ''; }
  if (awaiting) { cur = '0'; awaiting = false; }
  if (cur === '0') return;
  cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
}
function percent() {
  if (error) return;
  if (justEvaluated) { tokens = []; justEvaluated = false; lastExpr = ''; }
  awaiting = false;
  cur = String(parseFloat((parseFloat(cur) / 100).toPrecision(12)));
}
function deleteLast() {
  if (error || justEvaluated) { resetAll(); return; }
  if (awaiting) { tokens.pop(); cur = tokens.pop(); awaiting = false; return; }
  cur = cur.slice(0, -1);
  if (cur === '' || cur === '-') cur = '0';
}

// Operations
function inputOperator(op) {
  if (error) return;
  if (justEvaluated) { tokens = []; justEvaluated = false; lastExpr = ''; }
  if (awaiting) { tokens[tokens.length - 1] = op; return; }   // replace repeated operator
  tokens.push(String(parseFloat(cur)), op);
  awaiting = true;
}

// Calculate Result
function evaluate(list) {
  const t = list.slice();
  for (let pass = 0; pass < 2; pass++) {
    const ops = pass === 0 ? ['*', '/'] : ['+', '-'];
    for (let i = 1; i < t.length; i += 2) {
      if (!ops.includes(t[i])) continue;
      const a = parseFloat(t[i - 1]), b = parseFloat(t[i + 1]);
      if (t[i] === '/' && b === 0) throw new Error('div0');
      const v = t[i] === '*' ? a * b : t[i] === '/' ? a / b : t[i] === '+' ? a + b : a - b;
      t.splice(i - 1, 3, String(v));
      i -= 2;
    }
  }
  return parseFloat(parseFloat(t[0]).toPrecision(12));
}
function calculate() {
  if (error || justEvaluated) return;
  const list = awaiting ? tokens.slice(0, -1) : tokens.concat(String(parseFloat(cur)));
  if (list.length < 3) { if (awaiting) { tokens = []; awaiting = false; } return; }
  const text = list.map(t => SYMBOLS[t] || formatNumber(t)).join(' ');
  try {
    const value = evaluate(list);
    if (!isFinite(value)) throw new Error('overflow');
    cur = String(value);
    lastExpr = text + ' =';
    saveHistory(text, cur);
  } catch (e) {
    error = true;
    cur = e.message === 'div0' ? 'Cannot divide by zero' : 'Error';
    lastExpr = text;
  }
  tokens = []; awaiting = false; justEvaluated = true;
}

// Action Dispatcher
function handle(action, value) {
  if (action === 'digit') inputDigit(value);
  else if (action === 'decimal') inputDecimal();
  else if (action === 'operator') inputOperator(value);
  else if (action === 'percent') percent();
  else if (action === 'negate') negate();
  else if (action === 'delete') deleteLast();
  else if (action === 'clear') resetAll();
  else if (action === 'equals') calculate();
  render(action === 'equals');
}
keypad.addEventListener('click', e => {
  const b = e.target.closest('.btn');
  if (b) handle(b.dataset.action, b.dataset.value);
});

// Keyboard Support
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && historyPanel.classList.contains('open')) { toggleHistory(false); return; }
  const key = e.key === '=' ? 'Enter' : e.key === 'x' || e.key === 'X' ? '*' : e.key;
  const btn = keypad.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (!btn) return;
  e.preventDefault();
  handle(btn.dataset.action, btn.dataset.value);
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 120);
});

// History
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
}
function saveHistory(expression, result) {
  const h = loadHistory();
  h.unshift({ expression, result });
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX))); } catch (e) {}
  renderHistory();
}
function renderHistory() {
  const h = loadHistory();
  historyList.innerHTML = '';
  if (!h.length) {
    historyList.innerHTML = '<li class="history-empty">No calculations yet. Press = to save one.</li>';
    return;
  }
  h.forEach(item => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'history-item';
    b.innerHTML = '<span></span><b></b>';
    b.children[0].textContent = item.expression;
    b.children[1].textContent = formatNumber(item.result);
    b.addEventListener('click', () => {
      resetAll(); cur = item.result; render(true); toggleHistory(false);
    });
    li.appendChild(b);
    historyList.appendChild(li);
  });
}
function toggleHistory(open) {
  historyPanel.classList.toggle('open', open);
  historyPanel.setAttribute('aria-hidden', String(!open));
  historyToggle.setAttribute('aria-expanded', String(open));
  (open ? document.getElementById('historyClose') : historyToggle).focus();
}
historyToggle.addEventListener('click', () => toggleHistory(true));
document.getElementById('historyClose').addEventListener('click', () => toggleHistory(false));
document.getElementById('clearHistory').addEventListener('click', () => {
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
  renderHistory();
  showToast('History cleared');
});

// Copy Result
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
document.getElementById('copyBtn').addEventListener('click', async () => {
  if (error) { showToast('Nothing to copy'); return; }
  try {
    await navigator.clipboard.writeText(cur);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = cur; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (err) {}
    ta.remove();
  }
  showToast('Result copied');
});

// Init
renderHistory();
render(false);
