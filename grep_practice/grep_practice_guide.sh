#!/bin/bash

# Comprehensive Grep Practice Guide
# This script demonstrates all major grep options and use cases

echo "=== GREP PRACTICE GUIDE ==="
echo "This script demonstrates various grep options and patterns"
echo "Make sure you're in the grep_practice directory"
echo

# Basic Pattern Matching
echo "1. BASIC PATTERN MATCHING"
echo "========================="
echo "grep 'ERROR' text_files/sample.txt"
echo "grep 'hello' text_files/sample.txt"
echo

# Case Sensitivity Options
echo "2. CASE SENSITIVITY"
echo "==================="
echo "# Case sensitive (default)"
echo "grep 'error' case_sensitive/mixed_case.txt"
echo
echo "# Case insensitive (-i)"
echo "grep -i 'error' case_sensitive/mixed_case.txt"
echo

# Line Number Options
echo "3. LINE NUMBERS"
echo "==============="
echo "# Show line numbers (-n)"
echo "grep -n 'ERROR' text_files/sample.txt"
echo
echo "# Show only line numbers (--line-number)"
echo "grep --line-number 'WARNING' text_files/sample.txt"
echo

# Count Options
echo "4. COUNT MATCHES"
echo "================"
echo "# Count matching lines (-c)"
echo "grep -c 'INFO' config_files/log_file.log"
echo
echo "# Count all occurrences (not just lines)"
echo "grep -o 'the' text_files/sample.txt | wc -l"
echo

# Invert Match
echo "5. INVERT MATCH"
echo "==============="
echo "# Show non-matching lines (-v)"
echo "grep -v 'ERROR' text_files/sample.txt"
echo
echo "# Show lines without numbers"
echo "grep -v '[0-9]' text_files/sample.txt"
echo

# Whole Word Matching
echo "6. WHOLE WORD MATCHING"
echo "======================"
echo "# Match whole words only (-w)"
echo "grep -w 'test' text_files/sample.txt"
echo "grep 'test' text_files/sample.txt"  # Compare without -w
echo

# Multiple Files
echo "7. MULTIPLE FILES"
echo "================="
echo "# Search in multiple files"
echo "grep 'ERROR' text_files/*.txt"
echo
echo "# Show filename with matches (-H)"
echo "grep -H 'function' code_files/*"
echo
echo "# Hide filename (-h)"
echo "grep -h 'INFO' config_files/*"
echo

# Recursive Search
echo "8. RECURSIVE SEARCH"
echo "==================="
echo "# Search recursively (-r or -R)"
echo "grep -r 'SEARCH_PATTERN' recursive_test/"
echo
echo "# Recursive with line numbers"
echo "grep -rn 'ERROR' recursive_test/"
echo
echo "# Recursive case insensitive"
echo "grep -ri 'function' recursive_test/"
echo

# Context Options
echo "9. CONTEXT LINES"
echo "================"
echo "# Show lines after match (-A)"
echo "grep -A 2 'ERROR' config_files/log_file.log"
echo
echo "# Show lines before match (-B)"
echo "grep -B 2 'ERROR' config_files/log_file.log"
echo
echo "# Show lines before and after (-C)"
echo "grep -C 3 'CRITICAL' config_files/log_file.log"
echo

# File Type Filters
echo "10. FILE TYPE FILTERS"
echo "===================="
echo "# Include specific file types (--include)"
echo "grep -r --include='*.py' 'def' ."
echo "grep -r --include='*.txt' 'ERROR' ."
echo
echo "# Exclude specific file types (--exclude)"
echo "grep -r --exclude='*.log' 'INFO' ."
echo
echo "# Exclude directories (--exclude-dir)"
echo "grep -r --exclude-dir='binary_files' 'ERROR' ."
echo

# Regular Expressions
echo "11. REGULAR EXPRESSIONS"
echo "======================="
echo "# Basic regex (default)"
echo "grep '[0-9]\\+' text_files/numbers.txt"
echo
echo "# Extended regex (-E)"
echo "grep -E '[0-9]+' text_files/numbers.txt"
echo "grep -E '(ERROR|WARNING)' text_files/sample.txt"
echo
echo "# Perl-compatible regex (-P) - if available"
echo "grep -P '\\d+' text_files/numbers.txt"
echo

# Fixed String Search
echo "12. FIXED STRING SEARCH"
echo "======================="
echo "# Treat pattern as fixed string (-F)"
echo "grep -F '.*' text_files/special_chars.txt"
echo "grep -F '[ERROR]' text_files/sample.txt"
echo

# Only Show Matches
echo "13. ONLY SHOW MATCHES"
echo "===================="
echo "# Show only matching part (-o)"
echo "grep -o '[0-9]\\+' text_files/numbers.txt"
echo
echo "# Show only email addresses"
echo "grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' text_files/sample.txt"
echo

# Quiet Mode
echo "14. QUIET MODE"
echo "=============="
echo "# Suppress output, only return exit code (-q)"
echo "if grep -q 'ERROR' text_files/sample.txt; then"
echo "    echo 'ERROR found in file'"
echo "else"
echo "    echo 'No ERROR found'"
echo "fi"
echo

# Binary Files
echo "15. BINARY FILES"
echo "================"
echo "# Search binary files (-a)"
echo "grep -a 'Binary' binary_files/mixed_content.txt"
echo
echo "# Ignore binary files (-I)"
echo "grep -I 'content' binary_files/*"
echo
echo "# Show binary file matches without content (--binary-files=without-match)"
echo "grep --binary-files=without-match 'content' binary_files/*"
echo

# Maximum Count
echo "16. MAXIMUM COUNT"
echo "================="
echo "# Stop after N matches (-m)"
echo "grep -m 3 'INFO' config_files/log_file.log"
echo

# Null Character Separator
echo "17. NULL SEPARATOR"
echo "=================="
echo "# Use null character as separator (-z)"
echo "grep -z 'pattern' text_files/sample.txt"
echo

# Color Output
echo "18. COLOR OUTPUT"
echo "================"
echo "# Colorize output (--color)"
echo "grep --color=always 'ERROR' text_files/sample.txt"
echo "grep --color=never 'ERROR' text_files/sample.txt"
echo "grep --color=auto 'ERROR' text_files/sample.txt"
echo

# Advanced Patterns
echo "19. ADVANCED PATTERNS"
echo "===================="
echo "# Match IP addresses"
echo "grep -E '([0-9]{1,3}\\.){3}[0-9]{1,3}' text_files/numbers.txt"
echo
echo "# Match email addresses"
echo "grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' config_files/data.csv"
echo
echo "# Match phone numbers"
echo "grep -E '\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}' text_files/numbers.txt"
echo
echo "# Match dates (YYYY-MM-DD)"
echo "grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}' config_files/log_file.log"
echo

# Multiline Patterns
echo "20. MULTILINE PATTERNS"
echo "======================"
echo "# Note: grep doesn't handle multiline by default"
echo "# Use grep -Pzo for null-separated multiline (if available)"
echo "# Or use other tools like awk, sed, or pcregrep"
echo

# Performance Options
echo "21. PERFORMANCE OPTIONS"
echo "======================="
echo "# Show only filenames with matches (-l)"
echo "grep -l 'ERROR' config_files/*"
echo
echo "# Show only filenames without matches (-L)"
echo "grep -L 'ERROR' config_files/*"
echo

# Common Use Cases
echo "22. COMMON USE CASES"
echo "==================="
echo "# Find TODO comments in code"
echo "grep -rn 'TODO\\|FIXME' code_files/"
echo
echo "# Find function definitions in Python"
echo "grep -n '^def ' code_files/*.py"
echo
echo "# Find import statements"
echo "grep '^import\\|^from.*import' code_files/*.py"
echo
echo "# Search for specific log levels"
echo "grep -E '(ERROR|CRITICAL|FATAL)' config_files/log_file.log"
echo
echo "# Find empty lines"
echo "grep -n '^$' text_files/sample.txt"
echo

echo "=== END OF GREP PRACTICE GUIDE ==="
echo
echo "To run any of these commands, copy and paste them into your terminal"
echo "Make sure you're in the grep_practice directory first!"
echo
echo "Additional tips:"
echo "- Use 'man grep' for complete documentation"
echo "- Combine options: grep -rin 'pattern' ."
echo "- Use quotes around patterns with special characters"
echo "- Test patterns with simple examples first"
