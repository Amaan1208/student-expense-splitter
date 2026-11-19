// JavaScript port of ExpenseSplitter.java. Same classes, same rules.

const CATEGORIES = ['FOOD', 'TRAVEL', 'RENT', 'ENTERTAINMENT'];

class InvalidAmountException extends Error {}

class Person {
  constructor(name) { this.name = name; }
  toString() { return this.name; }
}

class Student extends Person {
  static count = 0;
  constructor(name) {
    super(name);
    Student.count++;
    this.id = Student.count;
  }
  static getCount() { return Student.count; }
  toString() { return '#' + this.id + ' ' + this.name; }
}

// Abstract parent: each child splits differently.
class Expense {
  constructor(description, amount, payer, category, participants) {
    if (new.target === Expense) throw new Error('Expense is abstract');
    if (!(amount > 0) || !isFinite(amount)) {
      throw new InvalidAmountException('Amount must be positive: ' + description);
    }
    this.description = description;
    this.amount = amount;
    this.payer = payer;
    this.category = category;
    this.participants = participants;
  }
  getShare() { throw new Error('getShare is abstract'); }
}

class EqualExpense extends Expense {
  get kind() { return 'Equal'; }
  getShare(s) {
    if (!this.participants.includes(s)) return 0;
    return this.amount / this.participants.length;
  }
}

class PercentExpense extends Expense {
  get kind() { return 'Percent'; }
  constructor(description, amount, payer, category, participants, percents) {
    super(description, amount, payer, category, participants);
    const sum = percents.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new InvalidAmountException('Percentages must add up to 100: ' + description);
    }
    this.percents = percents;
  }
  getShare(s) {
    const i = this.participants.indexOf(s);
    if (i === -1) return 0;
    return this.amount * this.percents[i] / 100;
  }
}

class ExactExpense extends Expense {
  get kind() { return 'Exact'; }
  constructor(description, amount, payer, category, participants, amounts) {
    super(description, amount, payer, category, participants);
    const sum = amounts.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - amount) > 0.01) {
      throw new InvalidAmountException('Exact amounts must add up to the total: ' + description);
    }
    this.amounts = amounts;
  }
  getShare(s) {
    const i = this.participants.indexOf(s);
    if (i === -1) return 0;
    return this.amounts[i];
  }
}

// A debt that can be paid in parts (implements Payable: pay, getRemaining).
class Debt {
  constructor(from, to, total) {
    this.from = from;
    this.to = to;
    this.total = total;
    this.paidSoFar = 0;
  }
  pay(amount) {
    if (!(amount > 0) || amount > this.getRemaining() + 0.01) {
      throw new InvalidAmountException('Invalid payment of ' + amount);
    }
    this.paidSoFar += amount;
  }
  getRemaining() { return Math.max(0, this.total - this.paidSoFar); }
}

class Splitter {
  constructor() {
    this.students = [];
    this.expenses = [];
    this.debts = [];
  }

  addStudent(s) { this.students.push(s); }
  addExpense(e) { this.expenses.push(e); }

  // positive = should get money back, negative = owes money
  getBalance(s) {
    let balance = 0;
    for (const e of this.expenses) {
      if (e.payer === s) balance += e.amount;
      balance -= e.getShare(s);
    }
    return balance;
  }

  getStats() {
    if (this.expenses.length === 0 || this.students.length === 0) return null;
    let total = 0;
    let biggest = this.expenses[0];
    for (const e of this.expenses) {
      total += e.amount;
      if (e.amount > biggest.amount) biggest = e;
    }
    let topPayer = this.students[0];
    let topPaid = 0;
    for (const s of this.students) {
      let paid = 0;
      for (const e of this.expenses) if (e.payer === s) paid += e.amount;
      if (paid > topPaid) { topPaid = paid; topPayer = s; }
    }
    const byCategory = {};
    for (const c of CATEGORIES) {
      byCategory[c] = this.expenses
        .filter((e) => e.category === c)
        .reduce((a, e) => a + e.amount, 0);
    }
    return {
      total,
      average: total / this.students.length,
      biggest,
      topPayer,
      topPaid,
      byCategory,
    };
  }

  // Smart settlement: fewest payments (at most students - 1).
  settle() {
    const bal = this.students.map((s) => this.getBalance(s));
    this.debts = [];
    while (true) {
      let low = 0;
      let high = 0;
      for (let i = 0; i < bal.length; i++) {
        if (bal[i] < bal[low]) low = i;
        if (bal[i] > bal[high]) high = i;
      }
      if (bal[low] > -0.01 || bal[high] < 0.01) break;
      const amt = Math.min(-bal[low], bal[high]);
      this.debts.push(new Debt(this.students[low], this.students[high], amt));
      bal[low] += amt;
      bal[high] -= amt;
    }
  }
}
