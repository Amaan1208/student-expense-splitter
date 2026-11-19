# Student Expense Splitter

Java OOP project that splits shared expenses between students (equal, percentage or exact split), shows stats, and works out the fewest payments needed to settle up. Debts can be paid in parts.

## Run

```
javac ExpenseSplitter.java
java ExpenseSplitter
```

## Web app

`index.html` is a browser version of the same logic (`splitter.js` is a JavaScript port of the Java classes, `app.js` is the UI). No build step. Open `index.html` or run `python3 -m http.server` and visit localhost:8000. Tap "Load demo" to replay the scenario from `main()`.
