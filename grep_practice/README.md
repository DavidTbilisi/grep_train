# Grep Practice Environment

This directory contains a comprehensive set of files and folders designed to practice all possible grep options and use cases.

## Directory Structure

```
grep_practice/
├── README.md                     # This file
├── grep_practice_guide.sh        # Comprehensive grep examples script
├── text_files/                   # Various text files for basic pattern matching
│   ├── sample.txt                # Mixed content with various patterns
│   ├── multiline.txt             # Multi-line code blocks and structures
│   ├── numbers.txt               # Numbers, IPs, emails, dates, etc.
│   └── special_chars.txt         # Special characters and Unicode
├── code_files/                   # Source code in different languages
│   ├── example.py                # Python code with classes and functions
│   ├── example.js                # JavaScript with async/await patterns
│   ├── example.java              # Java with OOP concepts
│   ├── example.cpp               # C++ with templates and STL
│   └── example.html              # HTML with various tags and attributes
├── config_files/                 # Configuration and data files
│   ├── config.json               # JSON configuration
│   ├── config.yaml               # YAML configuration
│   ├── config.ini                # INI configuration
│   ├── log_file.log              # Application log with different levels
│   └── data.csv                  # CSV data file
├── case_sensitive/               # Files for case sensitivity testing
│   └── mixed_case.txt            # Mixed case variations
├── binary_files/                 # Files for binary handling tests
│   └── mixed_content.txt         # Mixed text/binary content
└── recursive_test/               # Directory structure for recursive searches
    ├── root_file.txt             # File at root level
    ├── subdir1/
    │   └── file1.txt             # Text file in subdirectory 1
    ├── subdir2/
    │   └── file2.py              # Python file in subdirectory 2
    └── subdir3/
        └── file3.log             # Log file in subdirectory 3
```

## Grep Options Covered

### Basic Options

- Pattern matching (literal strings)
- Case sensitivity (`-i`)
- Line numbers (`-n`)
- Count matches (`-c`)
- Invert match (`-v`)
- Whole word matching (`-w`)

### File Handling

- Multiple files
- Recursive search (`-r`, `-R`)
- File inclusion/exclusion (`--include`, `--exclude`)
- Directory exclusion (`--exclude-dir`)
- Binary file handling (`-a`, `-I`)

### Output Control

- Show/hide filenames (`-H`, `-h`)
- Context lines (`-A`, `-B`, `-C`)
- Only show matches (`-o`)
- Quiet mode (`-q`)
- Color output (`--color`)
- Maximum count (`-m`)

### Pattern Types

- Basic regex (default)
- Extended regex (`-E`)
- Fixed strings (`-F`)
- Perl-compatible regex (`-P`)

### Advanced Features

- Null separator (`-z`)
- List matching files (`-l`)
- List non-matching files (`-L`)

## Common Pattern Examples

### Search for errors in logs

```bash
grep -i 'error\|warning\|critical' config_files/log_file.log
```

### Find function definitions in code

```bash
grep -rn 'def\|function\|void.*(' code_files/
```

### Search for email addresses

```bash
grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' text_files/sample.txt
```

### Find TODO comments

```bash
grep -rn 'TODO\|FIXME' code_files/
```

### Search with context

```bash
grep -C 3 'ERROR' config_files/log_file.log
```

## Getting Started

1. Navigate to the grep_practice directory:

   ```bash
   cd grep_practice
   ```

2. Run the practice guide to see all examples:

   ```bash
   bash grep_practice_guide.sh
   ```

3. Try basic commands:

   ```bash
   # Basic search
   grep 'ERROR' text_files/sample.txt

   # Case insensitive search
   grep -i 'hello' text_files/sample.txt

   # Recursive search
   grep -r 'function' .
   ```

4. Practice with different file types:

   ```bash
   # Search in code files
   grep -n 'class\|def' code_files/*.py

   # Search in config files
   grep -i 'password\|secret' config_files/*

   # Search in logs
   grep -E '(ERROR|WARN|INFO)' config_files/log_file.log
   ```

## Tips for Practice

1. **Start Simple**: Begin with basic string searches before moving to regex
2. **Use Quotes**: Always quote patterns with special characters
3. **Combine Options**: Try combining multiple options like `-rin`
4. **Test Incrementally**: Build complex patterns step by step
5. **Read Man Pages**: Use `man grep` for complete documentation

## Advanced Exercises

1. Find all IP addresses in any file
2. Search for function calls with parameters
3. Find lines that don't contain specific patterns
4. Extract all dates in YYYY-MM-DD format
5. Search for SQL keywords in code files
6. Find empty lines or lines with only whitespace
7. Search for configuration values in different formats

Happy grepping! 🔍
