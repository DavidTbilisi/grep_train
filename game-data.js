// Game Data - Levels, Challenges, and File Contents

const GAME_DATA = {
  levels: [
    {
      id: 1,
      title: "Level 1: Basic Pattern Matching",
      description: "Master the fundamentals of grep pattern matching",
      challenges: [
        {
          id: 1,
          title: "Find Error Messages",
          description: "Find all lines containing 'ERROR' in the log file.",
          files: {
            "app.log": `2024-01-15 10:30:00 INFO Application starting
2024-01-15 10:30:01 DEBUG Database connection established  
2024-01-15 10:30:02 ERROR Failed to load configuration
2024-01-15 10:30:03 INFO User john_doe logged in
2024-01-15 10:30:04 WARNING Memory usage high: 85%
2024-01-15 10:30:05 ERROR Database connection timeout
2024-01-15 10:30:06 INFO Processing request #1234
2024-01-15 10:30:07 ERROR Invalid user credentials
2024-01-15 10:30:08 INFO Request completed successfully
2024-01-15 10:30:09 DEBUG Cache cleared`,
          },
          correctCommand: "grep 'ERROR' app.log",
          expectedOutput: [
            "2024-01-15 10:30:02 ERROR Failed to load configuration",
            "2024-01-15 10:30:05 ERROR Database connection timeout",
            "2024-01-15 10:30:07 ERROR Invalid user credentials",
          ],
          hints: [
            "Use grep followed by the pattern you want to search for",
            "The basic syntax is: grep 'pattern' filename",
            "Make sure to put the pattern in quotes",
          ],
          timeLimit: 60,
          points: 100,
        },
        {
          id: 2,
          title: "Case Insensitive Search",
          description:
            "Find all lines containing 'warning' regardless of case.",
          files: {
            "system.log": `System started successfully
Warning: Disk space low
Configuration loaded
error: Network timeout
WARNING: High CPU usage detected
Info: Backup completed
warning: SSL certificate expires soon
Debug: Cache statistics updated
ERROR: Authentication failed`,
          },
          correctCommand: "grep -i 'warning' system.log",
          expectedOutput: [
            "Warning: Disk space low",
            "WARNING: High CPU usage detected",
            "warning: SSL certificate expires soon",
          ],
          hints: [
            "Use the -i flag to ignore case differences",
            "The -i option makes grep case-insensitive",
            "Try: grep -i 'pattern' filename",
          ],
          timeLimit: 60,
          points: 150,
        },
        {
          id: 3,
          title: "Show Line Numbers",
          description: "Find 'INFO' messages and show their line numbers.",
          files: {
            "debug.log": `Starting application
INFO: Database initialized
Loading configuration
INFO: Server listening on port 8080
Processing requests
INFO: User authentication enabled
Checking system health
INFO: All services running
Cleanup completed`,
          },
          correctCommand: "grep -n 'INFO' debug.log",
          expectedOutput: [
            "2:INFO: Database initialized",
            "4:INFO: Server listening on port 8080",
            "6:INFO: User authentication enabled",
            "8:INFO: All services running",
          ],
          hints: [
            "Use the -n flag to show line numbers",
            "Line numbers appear before the matching lines",
            "Combine it like: grep -n 'pattern' filename",
          ],
          timeLimit: 60,
          points: 150,
        },
      ],
    },
    {
      id: 2,
      title: "Level 2: Advanced Options",
      description: "Learn advanced grep options and techniques",
      challenges: [
        {
          id: 4,
          title: "Count Matching Lines",
          description:
            "Count how many lines contain 'failed' in the error log.",
          files: {
            "error.log": `Connection established
Login failed for user admin
Processing request
Login failed for user guest  
Database query executed
Login failed for user test
File uploaded successfully
Authentication failed
Operation completed
Login failed for user demo`,
          },
          correctCommand: "grep -c 'failed' error.log",
          expectedOutput: ["5"],
          hints: [
            "Use the -c flag to count matching lines",
            "This returns a number, not the actual lines",
            "Try: grep -c 'pattern' filename",
          ],
          timeLimit: 45,
          points: 200,
        },
        {
          id: 5,
          title: "Invert Match",
          description: "Show all lines that do NOT contain 'DEBUG'.",
          files: {
            "mixed.log": `INFO: Application started
DEBUG: Loading modules
ERROR: Configuration missing
DEBUG: Database connected
WARNING: Low disk space
DEBUG: Processing request
INFO: User logged in
DEBUG: Cache updated
ERROR: Network timeout`,
          },
          correctCommand: "grep -v 'DEBUG' mixed.log",
          expectedOutput: [
            "INFO: Application started",
            "ERROR: Configuration missing",
            "WARNING: Low disk space",
            "INFO: User logged in",
            "ERROR: Network timeout",
          ],
          hints: [
            "Use the -v flag to invert the match",
            "This shows lines that DON'T contain the pattern",
            "Syntax: grep -v 'pattern' filename",
          ],
          timeLimit: 45,
          points: 200,
        },
        {
          id: 6,
          title: "Whole Word Matching",
          description:
            "Find lines containing the whole word 'test' (not 'testing' or 'latest').",
          files: {
            "code.txt": `def test_function():
    return testing_mode
def latest_update():
    test = True
    return test
def test():
    testing = False
    test_case = 'example'`,
          },
          correctCommand: "grep -w 'test' code.txt",
          expectedOutput: ["    test = True", "    return test", "def test():"],
          hints: [
            "Use the -w flag to match whole words only",
            "This prevents matching partial words",
            "Try: grep -w 'pattern' filename",
          ],
          timeLimit: 45,
          points: 250,
        },
      ],
    },
    {
      id: 3,
      title: "Level 3: Regular Expressions",
      description: "Master pattern matching with regular expressions",
      challenges: [
        {
          id: 7,
          title: "Find Numbers",
          description: "Find all lines containing numbers using regex.",
          files: {
            "data.txt": `User logged in
Error code 404 occurred
System running normally
Port 8080 is open
No issues detected
Response time: 250ms
All systems operational
Memory usage: 75%`,
          },
          correctCommand: "grep '[0-9]' data.txt",
          expectedOutput: [
            "Error code 404 occurred",
            "Port 8080 is open",
            "Response time: 250ms",
            "Memory usage: 75%",
          ],
          hints: [
            "Use [0-9] to match any digit",
            "Square brackets define character classes",
            "Try: grep '[0-9]' filename",
          ],
          timeLimit: 60,
          points: 300,
        },
        {
          id: 8,
          title: "Email Pattern",
          description: "Find all lines containing email addresses.",
          files: {
            "contacts.txt": `John Doe - Manager
Email: john.doe@company.com
Phone: 555-1234
Jane Smith - Developer  
Contact: jane.smith@company.com
Address: 123 Main St
Mike Johnson
Email: mike@example.org
Department: Engineering`,
          },
          correctCommand:
            "grep '[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]*\\.[a-zA-Z]*' contacts.txt",
          expectedOutput: [
            "Email: john.doe@company.com",
            "Contact: jane.smith@company.com",
            "Email: mike@example.org",
          ],
          hints: [
            "Email pattern: user@domain.ext",
            "Use character classes and special characters",
            "The @ symbol is literal in the pattern",
          ],
          timeLimit: 90,
          points: 400,
        },
        {
          id: 9,
          title: "Extended Regex",
          description:
            "Use extended regex to find 'ERROR' or 'CRITICAL' messages.",
          files: {
            "alerts.log": `INFO: System healthy
WARNING: Disk space low
ERROR: Database connection failed
DEBUG: Processing request
CRITICAL: Security breach detected
INFO: Backup completed
ERROR: Authentication timeout
NOTICE: Maintenance scheduled
CRITICAL: System overload`,
          },
          correctCommand: "grep -E '(ERROR|CRITICAL)' alerts.log",
          expectedOutput: [
            "ERROR: Database connection failed",
            "CRITICAL: Security breach detected",
            "ERROR: Authentication timeout",
            "CRITICAL: System overload",
          ],
          hints: [
            "Use the -E flag for extended regex",
            "Use | to match multiple patterns: (pattern1|pattern2)",
            "Parentheses group the alternatives",
          ],
          timeLimit: 60,
          points: 350,
        },
      ],
    },
    {
      id: 4,
      title: "Level 4: Context and Advanced Features",
      description: "Master context lines and advanced grep features",
      challenges: [
        {
          id: 10,
          title: "Context Lines",
          description:
            "Find 'ERROR' and show 1 line before and after each match.",
          files: {
            "context.log": `Application started
Loading configuration
Database connected
User authentication enabled
Error occurred in module A
Stack trace available
Recovery initiated
System stabilized
Processing continues
Another error in module B
Diagnostic data collected
Error handling complete`,
          },
          correctCommand: "grep -C 1 'Error\\|error' context.log",
          expectedOutput: [
            "User authentication enabled",
            "Error occurred in module A",
            "Stack trace available",
            "--",
            "Processing continues",
            "Another error in module B",
            "Diagnostic data collected",
          ],
          hints: [
            "Use -C n to show n lines before and after",
            "You can also use -A (after) and -B (before) separately",
            "Use \\| to match multiple patterns",
          ],
          timeLimit: 75,
          points: 400,
        },
        {
          id: 11,
          title: "Only Show Matches",
          description: "Extract only the IP addresses from the log file.",
          files: {
            "access.log": `User login from 192.168.1.100 successful
Failed attempt from 10.0.0.5 detected  
Admin access from 172.16.0.1 granted
Multiple requests from 192.168.1.250 blocked
System check from localhost completed
External access from 203.0.113.10 denied`,
          },
          correctCommand:
            "grep -o '[0-9]\\{1,3\\}\\.[0-9]\\{1,3\\}\\.[0-9]\\{1,3\\}\\.[0-9]\\{1,3\\}' access.log",
          expectedOutput: [
            "192.168.1.100",
            "10.0.0.5",
            "172.16.0.1",
            "192.168.1.250",
            "203.0.113.10",
          ],
          hints: [
            "Use -o to show only the matching part",
            "IP pattern: xxx.xxx.xxx.xxx where xxx is 1-3 digits",
            "Use \\{1,3\\} to match 1 to 3 digits",
          ],
          timeLimit: 90,
          points: 500,
        },
        {
          id: 12,
          title: "Multiple Files",
          description:
            "Search for 'function' in all provided files and show filenames.",
          files: {
            "script1.js": `function calculateSum(a, b) {
    return a + b;
}
var result = calculateSum(5, 3);`,
            "script2.js": `const myFunction = () => {
    console.log('Hello World');
};
myFunction();`,
            "script3.js": `class Calculator {
    add(x, y) {
        return x + y;
    }
}`,
          },
          correctCommand: "grep -H 'function' script1.js script2.js script3.js",
          expectedOutput: ["script1.js:function calculateSum(a, b) {"],
          hints: [
            "Use -H to show filenames even with multiple files",
            "List all files after the pattern",
            "You can also use wildcards like *.js",
          ],
          timeLimit: 60,
          points: 300,
        },
      ],
    },
    {
      id: 5,
      title: "Level 5: Master Challenge",
      description: "Complex real-world scenarios and advanced techniques",
      challenges: [
        {
          id: 13,
          title: "Log Analysis",
          description:
            "Find all CRITICAL or ERROR entries with timestamps between 10:30 and 10:35.",
          files: {
            "production.log": `2024-01-15 10:28:45 INFO System startup complete
2024-01-15 10:30:12 ERROR Database connection failed
2024-01-15 10:31:23 WARNING High memory usage
2024-01-15 10:32:45 CRITICAL Security alert triggered  
2024-01-15 10:33:12 ERROR File not found: config.xml
2024-01-15 10:34:56 INFO User session created
2024-01-15 10:35:23 ERROR Network timeout occurred
2024-01-15 10:36:45 DEBUG Cache cleaned
2024-01-15 10:37:12 CRITICAL System overload detected`,
          },
          correctCommand:
            "grep -E '10:3[0-5].*?(ERROR|CRITICAL)' production.log",
          expectedOutput: [
            "2024-01-15 10:30:12 ERROR Database connection failed",
            "2024-01-15 10:32:45 CRITICAL Security alert triggered",
            "2024-01-15 10:33:12 ERROR File not found: config.xml",
            "2024-01-15 10:35:23 ERROR Network timeout occurred",
          ],
          hints: [
            "Combine time range and severity level patterns",
            "Use 10:3[0-5] to match times between 10:30-10:35",
            "Use .*? for non-greedy matching between patterns",
          ],
          timeLimit: 120,
          points: 600,
        },
        {
          id: 14,
          title: "Code Security Audit",
          description:
            "Find potential security issues: lines with 'password', 'secret', or 'key' (case insensitive).",
          files: {
            "config.py": `DATABASE_URL = "postgresql://localhost/app"
SECRET_KEY = "super-secret-key-123"
API_ENDPOINT = "https://api.example.com"
password = "admin123"
DEBUG = True
ENCRYPTION_KEY = "encryption-key-456"
LOG_LEVEL = "INFO"
api_secret = "secret-token-789"`,
          },
          correctCommand: "grep -i -E '(password|secret|key)' config.py",
          expectedOutput: [
            'SECRET_KEY = "super-secret-key-123"',
            'password = "admin123"',
            'ENCRYPTION_KEY = "encryption-key-456"',
            'api_secret = "secret-token-789"',
          ],
          hints: [
            "Combine -i for case insensitive and -E for extended regex",
            "Use (pattern1|pattern2|pattern3) for multiple alternatives",
            "This helps identify potential security vulnerabilities",
          ],
          timeLimit: 90,
          points: 550,
        },
        {
          id: 15,
          title: "Final Boss Challenge",
          description:
            "Extract all unique email domains from user data, showing only the domain part.",
          files: {
            "users.csv": `id,name,email,department
1,John Doe,john@company.com,Engineering
2,Jane Smith,jane@company.com,Marketing  
3,Bob Wilson,bob@example.org,Sales
4,Alice Brown,alice@company.com,Engineering
5,Charlie Davis,charlie@testsite.net,Support
6,Diana Miller,diana@example.org,Marketing
7,Eve Johnson,eve@newdomain.io,Engineering`,
          },
          correctCommand: "grep -o '@[a-zA-Z0-9.-]*\\.[a-zA-Z]*' users.csv",
          expectedOutput: [
            "@company.com",
            "@company.com",
            "@example.org",
            "@company.com",
            "@testsite.net",
            "@example.org",
            "@newdomain.io",
          ],
          hints: [
            "Use -o to extract only the matching part",
            "Pattern starts with @ and includes domain characters",
            "Domain pattern: @domain.extension",
          ],
          timeLimit: 120,
          points: 700,
        },
      ],
    },
  ],

  asciiArt: `
 ██████╗ ██████╗ ███████╗██████╗     ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ 
██╔════╝ ██╔══██╗██╔════╝██╔══██╗    ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
██║  ███╗██████╔╝█████╗  ██████╔╝    ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
██║   ██║██╔══██╗██╔══╝  ██╔═══╝     ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
╚██████╔╝██║  ██║███████╗██║         ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
 ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝         ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
                                                                                            
              Learn grep through interactive challenges and level up your command line skills!
    `,

  achievements: [
    {
      id: "first_grep",
      name: "First Grep",
      description: "Execute your first grep command",
      icon: "🔍",
    },
    {
      id: "case_master",
      name: "Case Master",
      description: "Master case-insensitive searching",
      icon: "🔤",
    },
    {
      id: "regex_rookie",
      name: "Regex Rookie",
      description: "Use your first regular expression",
      icon: "📝",
    },
    {
      id: "context_king",
      name: "Context King",
      description: "Use context lines effectively",
      icon: "📋",
    },
    {
      id: "speed_demon",
      name: "Speed Demon",
      description: "Complete a challenge in under 30 seconds",
      icon: "⚡",
    },
    {
      id: "perfectionist",
      name: "Perfectionist",
      description: "Complete a level without using hints",
      icon: "💎",
    },
    {
      id: "grep_master",
      name: "Grep Master",
      description: "Complete all challenges",
      icon: "🏆",
    },
  ],

  tips: [
    "Use single quotes around patterns to avoid shell interpretation",
    "The -r flag makes grep search directories recursively",
    "Combine multiple flags like -rin for recursive, case-insensitive search with line numbers",
    "Use ^ to match the beginning of a line and $ for the end",
    "The . (dot) matches any single character in regular expressions",
    "Use \\b for word boundaries in regular expressions",
    "The -v flag inverts the match, showing non-matching lines",
    "Use -A, -B, and -C for showing context lines around matches",
    "The -o flag shows only the matching part of the line",
    "Use character classes like [0-9] for digits or [a-zA-Z] for letters",
  ],
};

// Export for use in other files
if (typeof module !== "undefined" && module.exports) {
  module.exports = GAME_DATA;
}
