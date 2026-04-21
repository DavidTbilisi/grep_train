#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <algorithm>
#include <memory>
#include <stdexcept>

/**
 * C++ example file for grep practice
 * @author Example Developer
 * @version 1.0.0
 */

namespace ExampleApp {
    
    const std::string VERSION = "1.0.0";
    const int MAX_USERS = 1000;
    const bool DEBUG_MODE = true;
    
    class User {
    private:
        std::string username;
        std::string email;
        std::string created_at;
        
    public:
        User(const std::string& username, const std::string& email) 
            : username(username), email(email) {
            // TODO: Add proper timestamp
            created_at = "2024-01-15T10:30:00Z";
        }
        
        const std::string& getUsername() const { return username; }
        const std::string& getEmail() const { return email; }
        const std::string& getCreatedAt() const { return created_at; }
        
        void display() const {
            std::cout << "User: " << username << " (" << email << ")" << std::endl;
        }
    };
    
    class UserManager {
    private:
        std::vector<std::unique_ptr<User>> users;
        std::map<std::string, std::string> config;
        
        bool isValidEmail(const std::string& email) const {
            // Simple email validation
            size_t at_pos = email.find('@');
            size_t dot_pos = email.find('.', at_pos);
            return (at_pos != std::string::npos && 
                    dot_pos != std::string::npos && 
                    at_pos > 0 && 
                    dot_pos > at_pos + 1 && 
                    dot_pos < email.length() - 1);
        }
        
    public:
        UserManager() {
            config["database_url"] = "sqlite:///users.db";
            config["api_endpoint"] = "https://api.example.com";
            config["debug_enabled"] = "true";
            
            if (DEBUG_MODE) {
                std::cout << "INFO: UserManager initialized" << std::endl;
            }
        }
        
        bool createUser(const std::string& username, const std::string& email) {
            try {
                if (findUser(username) != nullptr) {
                    std::cerr << "ERROR: User " << username << " already exists" << std::endl;
                    return false;
                }
                
                if (!isValidEmail(email)) {
                    std::cerr << "WARNING: Invalid email format: " << email << std::endl;
                    return false;
                }
                
                auto user = std::make_unique<User>(username, email);
                users.push_back(std::move(user));
                
                std::cout << "INFO: Created user " << username << std::endl;
                return true;
                
            } catch (const std::exception& e) {
                std::cerr << "ERROR: Failed to create user " << username 
                         << ": " << e.what() << std::endl;
                return false;
            }
        }
        
        User* findUser(const std::string& username) const {
            auto it = std::find_if(users.begin(), users.end(),
                [&username](const std::unique_ptr<User>& user) {
                    return user->getUsername() == username;
                });
            
            if (it != users.end()) {
                return it->get();
            }
            
            if (DEBUG_MODE) {
                std::cout << "WARNING: User " << username << " not found" << std::endl;
            }
            return nullptr;
        }
        
        void listUsers() const {
            std::cout << "INFO: Listing all users (" << users.size() << " total):" << std::endl;
            for (const auto& user : users) {
                user->display();
            }
        }
        
        size_t getUserCount() const {
            return users.size();
        }
    };
}

int main() {
    using namespace ExampleApp;
    
    try {
        UserManager manager;
        
        // Test user creation
        manager.createUser("john_doe", "john@example.com");
        manager.createUser("jane_smith", "jane@example.com");
        manager.createUser("bob_wilson", "bob@invalid");  // Invalid email
        manager.createUser("john_doe", "john2@example.com");  // Duplicate username
        
        manager.listUsers();
        
        // TODO: Implement user deletion
        // FIXME: Add proper error handling for database operations
        
        std::cout << "INFO: Application version " << VERSION << std::endl;
        std::cout << "INFO: Total users created: " << manager.getUserCount() << std::endl;
        
    } catch (const std::exception& e) {
        std::cerr << "ERROR: Application failed: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
