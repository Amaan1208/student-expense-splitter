// UI for the expense splitter. Logic lives in splitter.js.
let sp = new Splitter();
let split = 'equal';
let category = 'FOOD';
let stale = false;
const picked = new Set();     // student ids sharing the expense
const vals = new Map();       // student id -> typed percent / exact value

const $ = (id) => document.getElementById(id);
const CHECK = '<svg viewBox="0 0 14 14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 7.5 3 3 6-7"/></svg>';
const ARROW = '<svg class="arrow" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="pays"><path d="M1 6h15M11 1.5 16 6l-5 4.5"/></svg>';
const STICKER = (n, w, h) => `<img class="sticker" src="stickers/s${n}.webp" width="${w}" height="${h}" alt="" loading="lazy">`;

const money = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 4200);
}
function showError(id, msg) {
  const el = $(id);
  el.textContent = msg || '';
  el.hidden = !msg;
}

// ---------- students ----------
function addStudent(name) {
  const s = new Student(name);
  sp.addStudent(s);
  picked.add(s.id);
  stale = sp.debts.length > 0;
  return s;
}

function renderStudents() {
  const list = $('student-list');
  $('student-count').textContent = sp.students.length;
  list.innerHTML = sp.students.length
    ? sp.students.map((s) => `<li>${esc(s)}</li>`).join('')
    : '<li class="none">Nobody yet. Add at least two people.</li>';

  const payer = $('e-payer');
  const keep = payer.value;
  payer.innerHTML = sp.students.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  if (keep && sp.students.some((s) => String(s.id) === keep)) payer.value = keep;
  renderWho();
}

// ---------- expense form ----------
function renderCategories() {
  $('seg-cat').innerHTML = CATEGORIES.map((c) =>
    `<button type="button" role="radio" aria-checked="${c === category}" data-cat="${c}">${cap(c)}</button>`).join('');
}

function renderWho() {
  const ul = $('who');
  if (!sp.students.length) {
    ul.innerHTML = '<li><span class="hint">Add students first.</span></li>';
    updateHint();
    return;
  }
  ul.innerHTML = sp.students.map((s) => {
    const on = picked.has(s.id);
    const input = split !== 'equal' && on
      ? `<label class="sr" for="v-${s.id}">${esc(s.name)} ${split === 'percent' ? 'percent' : 'amount'}</label>
         <input id="v-${s.id}" data-id="${s.id}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${split === 'percent' ? '%' : '₹'}" value="${esc(vals.get(s.id) ?? '')}">`
      : '';
    return `<li><button type="button" class="pick" data-id="${s.id}" aria-pressed="${on}">
      <span class="tick">${CHECK}</span><span class="name">${esc(s.name)}</span></button>${input}</li>`;
  }).join('');
  updateHint();
}

function updateHint() {
  const h = $('split-hint');
  h.className = 'hint';
  const ids = sp.students.filter((s) => picked.has(s.id));
  if (!ids.length) { h.textContent = 'Pick at least one person.'; return; }
  if (split === 'equal') { h.textContent = `Everyone picked pays the same. ${ids.length} sharing.`; return; }
  const sum = ids.reduce((a, s) => a + (parseFloat(vals.get(s.id)) || 0), 0);
  if (split === 'percent') {
    const ok = Math.abs(sum - 100) <= 0.01;
    h.textContent = `Percentages total ${+sum.toFixed(2)} of 100`;
    h.classList.add(ok ? 'ok' : 'bad');
  } else {
    const total = parseFloat($('e-amount').value) || 0;
    const ok = total > 0 && Math.abs(sum - total) <= 0.01;
    h.textContent = `Amounts total ${money(sum)} of ${money(total)}`;
    h.classList.add(ok ? 'ok' : 'bad');
  }
}

function submitExpense(ev) {
  ev.preventDefault();
  showError('expense-error', '');
  const desc = $('e-desc').value.trim();
  const amount = parseFloat($('e-amount').value);
  const payer = sp.students.find((s) => String(s.id) === $('e-payer').value);
  const people = sp.students.filter((s) => picked.has(s.id));
  try {
    if (sp.students.length < 2) throw new InvalidAmountException('Add at least two students first.');
    if (!desc) throw new InvalidAmountException('Say what the expense was for.');
    if (!people.length) throw new InvalidAmountException('Pick at least one person to share it.');
    const nums = people.map((s) => parseFloat(vals.get(s.id)));
    if (split !== 'equal' && nums.some((n) => isNaN(n))) {
      throw new InvalidAmountException('Enter a value for everyone sharing, or untick them.');
    }
    const args = [desc, amount, payer, category, people];
    let e;
    if (split === 'equal') e = new EqualExpense(...args);
    else if (split === 'percent') e = new PercentExpense(...args, nums);
    else e = new ExactExpense(...args, nums);
    sp.addExpense(e);
  } catch (err) {
    if (!(err instanceof InvalidAmountException)) throw err;
    showError('expense-error', err.message);
    return;
  }
  stale = sp.debts.length > 0;
  $('e-desc').value = '';
  $('e-amount').value = '';
  vals.clear();
  renderWho();
  render();
  toast(`Added ${desc}`);
}

// ---------- results ----------
function renderSettle() {
  $('stale').hidden = !stale;
  const ul = $('debts');
  if (!sp.debts.length) {
    ul.innerHTML = `<li class="empty">${STICKER(6, 88, 92)}<p>${sp.expenses.length
      ? 'Tap Settle up to see who pays whom.'
      : 'Add an expense, then settle up.'}</p></li>`;
  } else {
    ul.innerHTML = sp.debts.map((d, i) => {
      const rem = d.getRemaining();
      const pct = Math.min(100, (d.paidSoFar / d.total) * 100);
      const action = rem < 0.01
        ? `<span class="paid">${CHECK.replace('#fff', 'currentColor')}Settled</span>`
        : `<form class="pay" data-i="${i}" autocomplete="off">
             <label class="sr" for="p-${i}">Payment amount</label>
             <div class="money"><span aria-hidden="true">₹</span><input id="p-${i}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Pay part"></div>
             <button class="btn" type="submit">Pay</button></form>
             <p class="field-error" id="pe-${i}" role="alert" hidden style="padding:0"></p>`;
      return `<li class="debt">
        <div class="debt-top">
          <div class="row-title">${esc(d.from.name)}${ARROW}${esc(d.to.name)}</div>
          <div class="row-amt">${money(rem)}</div>
        </div>
        <div class="bar-track" role="img" aria-label="${Math.round(pct)} percent paid"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="row-sub">${money(d.paidSoFar)} paid of ${money(d.total)}</div>
        ${action}</li>`;
    }).join('');
  }
  $('balances').innerHTML = sp.students.length
    ? sp.students.map((s) => {
        const b = sp.getBalance(s);
        const cls = b > 0.005 ? 'pos' : b < -0.005 ? 'neg' : '';
        const word = b > 0.005 ? 'gets back' : b < -0.005 ? 'owes' : 'even';
        return `<li><div class="row-main"><div class="row-title">${esc(s.name)}</div></div>
          <div class="row-amt ${cls}">${b > 0.005 || b < -0.005 ? money(Math.abs(b)) + ' ' : ''}<span class="row-sub">${word}</span></div></li>`;
      }).join('')
    : '<li><span class="row-sub">No students yet.</span></li>';
  $('btn-settle').disabled = !sp.expenses.length;
}

function renderStats() {
  const st = sp.getStats();
  if (!st) {
    $('stats').innerHTML = `<div class="empty">${STICKER(5, 88, 92)}<p>Totals and category spending show up after the first expense.</p></div>`;
    return;
  }
  const max = Math.max(...Object.values(st.byCategory), 1);
  $('stats').innerHTML = `<ul class="stat-list">
      <li><span>Total spent</span><b>${money(st.total)}</b></li>
      <li><span>Average per student</span><b>${money(st.average)}</b></li>
      <li><span>Biggest expense</span><b>${esc(st.biggest.description)} (${money(st.biggest.amount)})</b></li>
      <li><span>Paid the most</span><b>${esc(st.topPayer.name)} (${money(st.topPaid)})</b></li>
    </ul>
    <div class="cats">${CATEGORIES.map((c) => `<div class="cat-row">
      <div class="cat-top"><span>${cap(c)}</span><span class="num">${money(st.byCategory[c])}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(st.byCategory[c] / max) * 100}%"></div></div></div>`).join('')}</div>`;
}

function renderExpenses() {
  $('expense-count').textContent = sp.expenses.length;
  $('expenses').innerHTML = sp.expenses.length
    ? [...sp.expenses].reverse().map((e) => `<li>
        <div class="row-main"><div class="row-title">${esc(e.description)}</div>
        <div class="row-sub">${esc(e.payer.name)} paid · ${cap(e.category)} · ${e.kind} · ${e.participants.length} sharing</div></div>
        <div class="row-amt">${money(e.amount)}</div></li>`).join('')
    : `<li class="empty">${STICKER(3, 96, 87)}<p>No expenses yet. Add one on the left, or load the demo.</p></li>`;
}

function render() {
  renderSettle();
  renderStats();
  renderExpenses();
}

// ---------- events ----------
$('student-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const input = $('student-name');
  const name = input.value.trim();
  if (!name) { showError('student-error', 'Type a name first.'); return; }
  if (sp.students.length >= 12) { showError('student-error', 'Twelve students is the limit here.'); return; }
  showError('student-error', '');
  addStudent(name);
  input.value = '';
  input.focus();
  renderStudents();
  render();
});

$('seg-cat').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-cat]');
  if (!b) return;
  category = b.dataset.cat;
  renderCategories();
});

$('seg-split').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-split]');
  if (!b) return;
  split = b.dataset.split;
  vals.clear();
  document.querySelectorAll('#seg-split button').forEach((x) => x.setAttribute('aria-checked', x === b));
  renderWho();
});

$('who').addEventListener('click', (ev) => {
  const b = ev.target.closest('.pick');
  if (!b) return;
  const id = Number(b.dataset.id);
  picked.has(id) ? picked.delete(id) : picked.add(id);
  renderWho();
});
$('who').addEventListener('input', (ev) => {
  if (ev.target.dataset.id) { vals.set(Number(ev.target.dataset.id), ev.target.value); updateHint(); }
});
$('e-amount').addEventListener('input', updateHint);
$('expense-form').addEventListener('submit', submitExpense);

$('btn-settle').addEventListener('click', () => {
  sp.settle();
  stale = false;
  renderSettle();
  toast(sp.debts.length
    ? `${sp.debts.length} payment${sp.debts.length > 1 ? 's' : ''} settle everything.`
    : 'Everyone is already even.');
});

$('debts').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.target.closest('.pay');
  const i = Number(form.dataset.i);
  const amt = parseFloat(form.querySelector('input').value);
  try {
    sp.debts[i].pay(amt);
  } catch (err) {
    if (!(err instanceof InvalidAmountException)) throw err;
    showError('pe-' + i, `${err.message}. Enter more than 0 and no more than ${money(sp.debts[i].getRemaining())}.`);
    return;
  }
  renderSettle();
});

function resetAll() {
  sp = new Splitter();
  Student.count = 0;
  picked.clear();
  vals.clear();
  stale = false;
  renderStudents();
  render();
}
$('btn-reset').addEventListener('click', () => { resetAll(); toast('Cleared.'); });

// Same scenario as main() in the Java version.
$('btn-demo').addEventListener('click', () => {
  resetAll();
  const [a, b, c] = ['Amaan', 'Rahul', 'Sara'].map(addStudent);
  const all = [a, b, c];
  sp.addExpense(new EqualExpense('Dinner', 120, a, 'FOOD', all));
  sp.addExpense(new EqualExpense('Taxi', 45, b, 'TRAVEL', [a, b]));
  sp.addExpense(new PercentExpense('Movie', 60, c, 'ENTERTAINMENT', all, [50, 30, 20]));
  sp.addExpense(new ExactExpense('Groceries', 90, a, 'FOOD', [b, c], [40, 50]));
  let msg = '';
  try {
    sp.addExpense(new EqualExpense('Snacks', -5, a, 'FOOD', all));
  } catch (err) { msg = 'Rejected "Snacks": ' + err.message; }
  sp.settle();
  try { sp.debts[0].pay(10); } catch (err) { msg = err.message; }
  renderStudents();
  render();
  toast(msg || 'Demo loaded.');
});

renderCategories();
renderStudents();
render();
