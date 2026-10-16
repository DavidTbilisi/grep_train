// Game Data - log files, levels, and challenges.
//
// Each challenge only needs a `solution`: the expected output is computed by
// running that solution through the shell simulator, so any command that
// prints the same output is accepted. `skills` (ids from skills.js) say what
// the challenge practises, so results feed the learner model.

const FILES = {
  "app.log": `2024-01-15 10:30:00 INFO Server starting on port 8080
2024-01-15 10:30:01 DEBUG Loading configuration from config.yml
2024-01-15 10:30:02 INFO Database connection established
2024-01-15 10:30:05 WARN Slow query took 2300ms
2024-01-15 10:30:07 INFO User alice logged in
2024-01-15 10:30:09 ERROR Timeout calling payment service
2024-01-15 10:30:12 DEBUG Cache hit ratio 0.82
2024-01-15 10:30:15 INFO User bob logged in
2024-01-15 10:30:18 ERROR Database connection lost
2024-01-15 10:30:19 WARN Retrying database connection
2024-01-15 10:30:21 INFO Database connection established
2024-01-15 10:30:25 ERROR Request timeout on /api/orders
2024-01-15 10:30:30 INFO User alice logged out
2024-01-15 10:30:33 WARN Memory usage at 91%
2024-01-15 10:30:40 INFO Shutdown requested
`,
  // Columns: time  ip  method  path  status  bytes
  "access.log": `10:30:01 192.168.1.10 GET /index.html 200 5120
10:30:02 10.0.0.5 GET /login 200 1840
10:30:03 10.0.0.5 POST /login 401 230
10:30:04 172.16.0.8 GET /products 200 8800
10:30:06 10.0.0.5 POST /login 401 230
10:30:07 203.0.113.7 GET /admin 404 512
10:30:09 192.168.1.10 GET /products 200 8800
10:30:11 10.0.0.5 POST /login 200 950
10:30:12 172.16.0.8 GET /cart 200 3100
10:30:14 203.0.113.7 GET /wp-login.php 404 512
10:30:15 192.168.1.10 POST /checkout 500 120
10:30:17 10.0.0.5 GET /dashboard 200 6400
10:30:20 172.16.0.8 GET /old-page 404 512
10:30:22 192.168.1.10 GET /index.html 200 5120
`,
};

const LEVELS = [
  {
    title: "Finding lines with grep",
    challenges: [
      {
        title: "Find the errors",
        description: "Show every line in app.log that contains ERROR.",
        learn: "grep PATTERN FILE prints only the lines of FILE that contain PATTERN.",
        files: ["app.log"],
        solution: "grep ERROR app.log",
        skills: ["grep-basic"],
        hints: ["Start with the word grep.", "Then the word to search for, then the file name.", "grep ERROR app.log"],
      },
      {
        title: "Ignore case",
        description: "Find every line about a timeout, whether it says Timeout or timeout.",
        learn: "grep is case-sensitive. The -i option makes it ignore case.",
        files: ["app.log"],
        solution: "grep -i timeout app.log",
        skills: ["grep-i"],
        hints: ["Options go right after the command name.", "-i means ignore case.", "grep -i timeout app.log"],
      },
      {
        title: "Hide the noise",
        description: "Show every line in app.log except the DEBUG lines.",
        learn: "The -v option inverts the match, so grep prints lines that do NOT contain the pattern.",
        files: ["app.log"],
        solution: "grep -v DEBUG app.log",
        skills: ["grep-v"],
        hints: ["You want the opposite of a normal search.", "-v inverts the match.", "grep -v DEBUG app.log"],
      },
    ],
  },
  {
    title: "Useful grep options",
    challenges: [
      {
        title: "Count them",
        description: "How many ERROR lines are in app.log? Print just the number.",
        learn: "The -c option prints a count of matching lines instead of the lines themselves.",
        files: ["app.log"],
        solution: "grep -c ERROR app.log",
        skills: ["grep-count"],
        hints: ["There is an option for counting.", "-c means count.", "grep -c ERROR app.log"],
      },
      {
        title: "Where are they?",
        description: "Show the WARN lines along with their line numbers.",
        learn: "The -n option puts the line number in front of each match, like 4:...",
        files: ["app.log"],
        solution: "grep -n WARN app.log",
        skills: ["grep-n"],
        hints: ["There is an option for line numbers.", "-n means number.", "grep -n WARN app.log"],
      },
      {
        title: "This or that",
        description: "Show every line that contains ERROR or WARN.",
        learn: "With -E (extended regex), A|B matches A or B. Quote the pattern so the shell leaves the | alone.",
        files: ["app.log"],
        solution: "grep -E 'ERROR|WARN' app.log",
        skills: ["grep-or"],
        hints: ["Use extended regex with -E.", "| means OR inside the pattern. Put the pattern in quotes.", "grep -E 'ERROR|WARN' app.log"],
      },
    ],
  },
  {
    title: "Reading logs",
    challenges: [
      {
        title: "The beginning",
        description: "Show only the first 3 lines of access.log.",
        learn: "head -n N FILE prints the first N lines of a file.",
        files: ["access.log", "app.log"],
        solution: "head -n 3 access.log",
        skills: ["head-tail"],
        hints: ["Use the head tool.", "-n sets how many lines.", "head -n 3 access.log"],
      },
      {
        title: "Latest entries",
        description: "Show only the last 2 lines of app.log. New entries are added at the bottom.",
        learn: "tail -n N FILE prints the last N lines. On real servers, tail -f follows a log as it grows.",
        files: ["app.log", "access.log"],
        solution: "tail -n 2 app.log",
        skills: ["head-tail"],
        hints: ["head shows the top. Which tool shows the bottom?", "tail -n N shows the last N lines.", "tail -n 2 app.log"],
      },
      {
        title: "How long is it?",
        description: "How many requests (lines) are in access.log?",
        learn: "wc counts things. wc -l counts lines.",
        files: ["access.log", "app.log"],
        solution: "wc -l access.log",
        skills: ["wc"],
        hints: ["wc stands for word count, but it can count lines too.", "-l means lines.", "wc -l access.log"],
      },
    ],
  },
  {
    title: "Pipes: chaining tools",
    challenges: [
      {
        title: "Pipe into wc",
        description: "How many requests got a 404 (not found) status? Use grep and wc together.",
        learn: "A pipe | sends the output of one command into the next: cmd1 | cmd2.",
        files: ["access.log"],
        solution: "grep 404 access.log | wc -l",
        skills: ["pipes", "wc"],
        hints: ["First, grep the 404 lines.", "Then pipe them into wc -l to count them.", "grep 404 access.log | wc -l"],
      },
      {
        title: "Most recent error",
        description: "Show only the last ERROR line in app.log.",
        learn: "You can pipe into head or tail to keep only the first or last few results.",
        files: ["app.log"],
        solution: "grep ERROR app.log | tail -n 1",
        skills: ["pipes", "head-tail"],
        hints: ["Find all the ERROR lines first.", "Pipe them into tail to keep only the last one.", "grep ERROR app.log | tail -n 1"],
      },
      {
        title: "Pick a column",
        description: "Print only the IP address of each request. It is the 2nd column of access.log.",
        learn: "awk '{print $2}' prints the 2nd whitespace-separated column. cut -d' ' -f2 does the same.",
        files: ["access.log"],
        solution: "awk '{print $2}' access.log",
        skills: ["columns"],
        hints: ["awk splits each line into columns: $1, $2, $3 ...", "Use single quotes around the awk program.", "awk '{print $2}' access.log"],
      },
    ],
  },
  {
    title: "Log analysis",
    challenges: [
      {
        title: "Unique visitors",
        description: "List each IP address that visited, once each, in sorted order.",
        learn: "sort puts lines in order. uniq removes repeated neighbouring lines, so always sort first.",
        files: ["access.log"],
        solution: "awk '{print $2}' access.log | sort | uniq",
        skills: ["sort-uniq"],
        hints: ["Start by printing the IP column.", "Pipe into sort, then into uniq.", "awk '{print $2}' access.log | sort | uniq"],
      },
      {
        title: "Status code report",
        description: "Count how many requests got each status code (5th column).",
        learn: "uniq -c puts a count in front of each unique line. That is a quick histogram.",
        files: ["access.log"],
        solution: "awk '{print $5}' access.log | sort | uniq -c",
        skills: ["uniq-count"],
        hints: ["Print column 5 with awk.", "sort, then uniq -c.", "awk '{print $5}' access.log | sort | uniq -c"],
      },
      {
        title: "Filter by column",
        description: "Show the path (4th column) of every request that returned 404.",
        learn: "awk can filter too: awk '$5 == 404 {print $4}' only prints lines where column 5 is 404.",
        files: ["access.log"],
        solution: "awk '$5 == 404 {print $4}' access.log",
        skills: ["awk-filter", "columns"],
        hints: ["Put a condition before the { print } part.", "Compare a column with ==, like $5 == 404.", "awk '$5 == 404 {print $4}' access.log"],
      },
      {
        title: "Top visitor",
        description: "Which IP made the most requests? Show its count and IP on one line.",
        learn: "sort -rn sorts numbers from biggest to smallest. Add head -n 1 to keep the top one.",
        files: ["access.log"],
        solution: "awk '{print $2}' access.log | sort | uniq -c | sort -rn | head -n 1",
        skills: ["top-n"],
        hints: [
          "Start from the uniq -c report, but use the IP column.",
          "Sort the counts with sort -rn (reverse numeric).",
          "awk '{print $2}' access.log | sort | uniq -c | sort -rn | head -n 1",
        ],
      },
    ],
  },
];

const ASCII_ART = `
 ██████╗ ██████╗ ███████╗██████╗     ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗
██╔════╝ ██╔══██╗██╔════╝██╔══██╗    ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
██║  ███╗██████╔╝█████╗  ██████╔╝    ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
██║   ██║██╔══██╗██╔══╝  ██╔═══╝     ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
╚██████╔╝██║  ██║███████╗██║         ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
 ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝         ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
`;

export { FILES, LEVELS, ASCII_ART };
