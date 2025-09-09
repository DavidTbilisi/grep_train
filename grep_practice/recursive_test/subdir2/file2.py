#!/usr/bin/env python3
"""
File in subdirectory 2 - Python file
"""

def search_function():
    """Function with SEARCH_PATTERN in docstring"""
    print("INFO: Function executed in subdir2")
    return "SUCCESS"

def another_function():
    """Another function for testing"""
    try:
        result = search_function()
        print(f"Result: {result}")
    except Exception as e:
        print(f"ERROR: {e}")

# TODO: Add more functionality
# FIXME: Handle edge cases

if __name__ == "__main__":
    another_function()
