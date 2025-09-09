package com.example.app;

import java.util.*;
import java.time.LocalDateTime;
import java.util.logging.Logger;
import java.util.logging.Level;

/**
 * Java example file for grep practice
 * @author Example Developer
 * @version 1.0.0
 */
public class Example {
    
    private static final Logger LOGGER = Logger.getLogger(Example.class.getName());
    private static final String VERSION = "1.0.0";
    private static final int MAX_USERS = 1000;
    
    private List<User> users;
    private Map<String, String> config;
    
    public Example() {
        this.users = new ArrayList<>();
        this.config = new HashMap<>();
        initializeConfig();
    }
    
    private void initializeConfig() {
        config.put("database.url", "jdbc:mysql://localhost:3306/myapp");
        config.put("database.username", "admin");
        config.put("database.password", "secret123");
        config.put("api.endpoint", "https://api.example.com");
        config.put("debug.enabled", "true");
    }
    
    /**
     * Creates a new user
     * @param username The username
     * @param email The email address
     * @return true if user was created successfully
     */
    public boolean createUser(String username, String email) {
        try {
            if (findUser(username) != null) {
                LOGGER.log(Level.SEVERE, "ERROR: User " + username + " already exists");
                return false;
            }
            
            if (!isValidEmail(email)) {
                LOGGER.log(Level.WARNING, "WARNING: Invalid email format: " + email);
                return false;
            }
            
            User user = new User(username, email, LocalDateTime.now());
            users.add(user);
            LOGGER.log(Level.INFO, "INFO: Created user " + username);
            return true;
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "ERROR: Failed to create user " + username, e);
            return false;
        }
    }
    
    /**
     * Finds a user by username
     * @param username The username to search for
     * @return User object or null if not found
     */
    public User findUser(String username) {
        for (User user : users) {
            if (user.getUsername().equals(username)) {
                return user;
            }
        }
        LOGGER.log(Level.WARNING, "WARNING: User " + username + " not found");
        return null;
    }
    
    /**
     * Validates email format
     * @param email Email to validate
     * @return true if email is valid
     */
    private boolean isValidEmail(String email) {
        String emailRegex = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$";
        return email.matches(emailRegex);
    }
    
    public static void main(String[] args) {
        Example app = new Example();
        
        // Test user creation
        app.createUser("john_doe", "john@example.com");
        app.createUser("jane_smith", "jane@example.com");
        app.createUser("invalid_user", "invalid-email");
        
        // TODO: Implement user authentication
        // FIXME: Add input validation for usernames
        
        System.out.println("INFO: Application version " + VERSION);
        System.out.println("INFO: Total users: " + app.users.size());
    }
    
    /**
     * Inner class representing a User
     */
    static class User {
        private String username;
        private String email;
        private LocalDateTime createdAt;
        
        public User(String username, String email, LocalDateTime createdAt) {
            this.username = username;
            this.email = email;
            this.createdAt = createdAt;
        }
        
        // Getters
        public String getUsername() { return username; }
        public String getEmail() { return email; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        
        @Override
        public String toString() {
            return "User{username='" + username + "', email='" + email + "'}";
        }
    }
}
