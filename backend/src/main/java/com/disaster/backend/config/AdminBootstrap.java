package com.disaster.backend.config;

import com.disaster.backend.model.AppUser;
import com.disaster.backend.model.Role;
import com.disaster.backend.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
public class AdminBootstrap {

    private static final Logger logger = LoggerFactory.getLogger(AdminBootstrap.class);

    @Bean
    CommandLineRunner createInitialAdmin(AppUserRepository users, PasswordEncoder passwordEncoder,
            @Value("${app.admin.email:}") String adminEmail,
            @Value("${app.admin.password:}") String adminPassword) {
        return args -> {
            if (adminEmail.isBlank() && adminPassword.isBlank()) {
                return;
            }
            if (adminEmail.isBlank() || adminPassword.length() < 12) {
                throw new IllegalStateException("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters together.");
            }

            String normalizedEmail = adminEmail.trim().toLowerCase(java.util.Locale.ROOT);
            String passwordHash = passwordEncoder.encode(adminPassword);
            AppUser admin = users.findByEmailIgnoreCase(normalizedEmail)
                    .orElseGet(() -> new AppUser(normalizedEmail, passwordHash, "Harbor Admin", Role.ADMIN));
            admin.setPasswordHash(passwordHash);
            admin.setRole(Role.ADMIN);
            users.save(admin);
            logger.info("Admin account provisioned from ADMIN_EMAIL configuration.");
        };
    }
}