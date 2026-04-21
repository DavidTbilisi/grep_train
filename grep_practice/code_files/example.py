#!/usr/bin/env python3
"""
Python example file for grep practice
"""

import os
import sys
import json
from datetime import datetime
from typing import List, Dict, Optional

# Constants
DEBUG = True
VERSION = "1.0.0"
MAX_RETRIES = 3

class UserManager:
    """Manages user operations"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.users = []
    
    def create_user(self, username: str, email: str) -> bool:
        """Create a new user"""
        if self.find_user(username):
            print(f"ERROR: User {username} already exists")
            return False
        
        user = {
            'username': username,
            'email': email,
            'created_at': datetime.now().isoformat()
        }
        self.users.append(user)
        print(f"INFO: Created user {username}")
        return True
    
    def find_user(self, username: str) -> Optional[Dict]:
        """Find user by username"""
        for user in self.users:
            if user['username'] == username:
                return user
        return None
    
    def delete_user(self, username: str) -> bool:
        """Delete user by username"""
        user = self.find_user(username)
        if not user:
            print(f"WARNING: User {username} not found")
            return False
        
        self.users.remove(user)
        print(f"INFO: Deleted user {username}")
        return True

def main():
    """Main function"""
    try:
        manager = UserManager("sqlite:///users.db")
        manager.create_user("john_doe", "john@example.com")
        manager.create_user("jane_smith", "jane@example.com")
        
        # TODO: Add password hashing
        # FIXME: Implement proper error handling
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
