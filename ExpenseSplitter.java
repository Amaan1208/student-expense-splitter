import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

// Feature 2: categories
enum Category { FOOD, TRAVEL, RENT, ENTERTAINMENT }

// Feature 7: interface
interface Payable {
    void pay(double amount) throws InvalidAmountException;
    double getRemaining();
}

class Person {
    protected String name;

    Person(String name) {
        this.name = name;
    }

    public String toString() {
        return name;
    }
}

class Student extends Person {
    private static int count = 0;
    private int id;

    Student(String name) {
        super(name);
        count++;
        id = count;
    }

    static int getCount() {
        return count;
    }

    public String toString() {
        return "#" + id + " " + name;
    }
}

class InvalidAmountException extends Exception {
    InvalidAmountException(String message) {
        super(message);
    }
}

// Feature 1: abstract parent, each child splits differently
abstract class Expense {
    protected String description;
    protected double amount;
    protected Student payer;
    protected Category category;
    protected List<Student> participants;   // Feature 3: only these people share the cost

    Expense(String description, double amount, Student payer, Category category,
            List<Student> participants) throws InvalidAmountException {
        if (amount <= 0) {
            throw new InvalidAmountException("Amount must be positive: " + description);
        }
        this.description = description;
        this.amount = amount;
        this.payer = payer;
        this.category = category;
        this.participants = participants;
    }

    // How much student s owes for this expense
    abstract double getShare(Student s);

    String getDescription() { return description; }
    double getAmount() { return amount; }
    Student getPayer() { return payer; }
    Category getCategory() { return category; }
}

class EqualExpense extends Expense {
    EqualExpense(String description, double amount, Student payer, Category category,
                 List<Student> participants) throws InvalidAmountException {
        super(description, amount, payer, category, participants);
    }

    double getShare(Student s) {
        if (!participants.contains(s)) {
            return 0;
        }
        return amount / participants.size();
    }
}

class PercentExpense extends Expense {
    private double[] percents;   // same order as participants

    PercentExpense(String description, double amount, Student payer, Category category,
                   List<Student> participants, double[] percents) throws InvalidAmountException {
        super(description, amount, payer, category, participants);
        double sum = 0;
        for (double p : percents) {
            sum += p;
        }
        if (Math.abs(sum - 100) > 0.01) {
            throw new InvalidAmountException("Percentages must add up to 100: " + description);
        }
        this.percents = percents;
    }

    double getShare(Student s) {
        int i = participants.indexOf(s);
        if (i == -1) {
            return 0;
        }
        return amount * percents[i] / 100;
    }
}

class ExactExpense extends Expense {
    private double[] amounts;   // same order as participants

    ExactExpense(String description, double amount, Student payer, Category category,
                 List<Student> participants, double[] amounts) throws InvalidAmountException {
        super(description, amount, payer, category, participants);
        double sum = 0;
        for (double a : amounts) {
            sum += a;
        }
        if (Math.abs(sum - amount) > 0.01) {
            throw new InvalidAmountException("Exact amounts must add up to the total: " + description);
        }
        this.amounts = amounts;
    }

    double getShare(Student s) {
        int i = participants.indexOf(s);
        if (i == -1) {
            return 0;
        }
        return amounts[i];
    }
}

// Feature 7: a debt that can be paid in parts
class Debt implements Payable {
    private Student from;
    private Student to;
    private double total;
    private double paidSoFar = 0;

    Debt(Student from, Student to, double total) {
        this.from = from;
        this.to = to;
        this.total = total;
    }

    public void pay(double amount) throws InvalidAmountException {
        if (amount <= 0 || amount > getRemaining() + 0.01) {
            throw new InvalidAmountException("Invalid payment of " + amount);
        }
        paidSoFar += amount;
    }

    public double getRemaining() {
        return total - paidSoFar;
    }

    public String toString() {
        return String.format("%s pays %s: %.2f remaining (of %.2f)", from, to, getRemaining(), total);
    }
}

class Splitter {
    private ArrayList<Student> students = new ArrayList<>();
    private ArrayList<Expense> expenses = new ArrayList<>();
    private ArrayList<Debt> debts = new ArrayList<>();

    void addStudent(Student s) {
        students.add(s);
    }

    void addExpense(Expense e) {
        expenses.add(e);
    }

    ArrayList<Debt> getDebts() {
        return debts;
    }

    // positive = should get money back, negative = owes money
    double getBalance(Student s) {
        double balance = 0;
        for (Expense e : expenses) {
            if (e.getPayer() == s) {
                balance += e.getAmount();
            }
            balance -= e.getShare(s);
        }
        return balance;
    }

    // Feature 5: stats
    void showStats() {
        double total = 0;
        Expense biggest = expenses.get(0);
        for (Expense e : expenses) {
            total += e.getAmount();
            if (e.getAmount() > biggest.getAmount()) {
                biggest = e;
            }
        }

        Student topPayer = students.get(0);
        double topPaid = 0;
        for (Student s : students) {
            double paid = 0;
            for (Expense e : expenses) {
                if (e.getPayer() == s) {
                    paid += e.getAmount();
                }
            }
            if (paid > topPaid) {
                topPaid = paid;
                topPayer = s;
            }
        }

        System.out.println("--- Stats ---");
        System.out.printf("Total spent: %.2f%n", total);
        System.out.printf("Average per student: %.2f%n", total / students.size());
        System.out.printf("Biggest expense: %s (%.2f)%n", biggest.getDescription(), biggest.getAmount());
        System.out.printf("Paid the most: %s (%.2f)%n", topPayer, topPaid);

        System.out.println("Spending by category:");
        for (Category c : Category.values()) {
            double sum = 0;
            for (Expense e : expenses) {
                if (e.getCategory() == c) {
                    sum += e.getAmount();
                }
            }
            System.out.printf("  %s: %.2f%n", c, sum);
        }
    }

    // Feature 6: smart settlement (fewest payments)
    void settle() {
        double[] bal = new double[students.size()];
        for (int i = 0; i < students.size(); i++) {
            bal[i] = getBalance(students.get(i));
        }

        debts.clear();
        while (true) {
            int low = 0;    // owes the most
            int high = 0;   // is owed the most
            for (int i = 0; i < bal.length; i++) {
                if (bal[i] < bal[low]) low = i;
                if (bal[i] > bal[high]) high = i;
            }
            if (bal[low] > -0.01 || bal[high] < 0.01) {
                break;
            }
            double amt = Math.min(-bal[low], bal[high]);
            debts.add(new Debt(students.get(low), students.get(high), amt));
            bal[low] += amt;
            bal[high] -= amt;
        }
    }

    void showDebts() {
        System.out.println("--- Debts ---");
        for (Debt d : debts) {
            System.out.println(d);
        }
    }
}

public class ExpenseSplitter {
    public static void main(String[] args) {
        Splitter splitter = new Splitter();

        Student a = new Student("Amaan");
        Student b = new Student("Rahul");
        Student c = new Student("Sara");
        splitter.addStudent(a);
        splitter.addStudent(b);
        splitter.addStudent(c);

        try {
            // Equal split between all three
            splitter.addExpense(new EqualExpense("Dinner", 120, a, Category.FOOD,
                    Arrays.asList(a, b, c)));
            // Equal split, Sara did not take the taxi
            splitter.addExpense(new EqualExpense("Taxi", 45, b, Category.TRAVEL,
                    Arrays.asList(a, b)));
            // Percentage split 50/30/20
            splitter.addExpense(new PercentExpense("Movie", 60, c, Category.ENTERTAINMENT,
                    Arrays.asList(a, b, c), new double[]{50, 30, 20}));
            // Exact amounts, Amaan paid for Rahul and Sara only
            splitter.addExpense(new ExactExpense("Groceries", 90, a, Category.FOOD,
                    Arrays.asList(b, c), new double[]{40, 50}));
            // Invalid, triggers the exception
            splitter.addExpense(new EqualExpense("Snacks", -5, a, Category.FOOD,
                    Arrays.asList(a, b, c)));
        } catch (InvalidAmountException e) {
            System.out.println("Error: " + e.getMessage());
        }

        System.out.println("Students: " + Student.getCount());
        splitter.showStats();

        splitter.settle();
        splitter.showDebts();

        // Partial payment of the first debt
        try {
            splitter.getDebts().get(0).pay(10);
        } catch (InvalidAmountException e) {
            System.out.println("Error: " + e.getMessage());
        }
        System.out.println("After a partial payment:");
        splitter.showDebts();
    }
}
