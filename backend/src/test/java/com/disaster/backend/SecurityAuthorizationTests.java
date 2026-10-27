package com.disaster.backend;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.disaster.backend.repository.AppUserRepository;
import com.disaster.backend.model.Disaster;
import com.disaster.backend.model.EmergencyRequest;
import com.disaster.backend.repository.DisasterRepository;
import com.disaster.backend.repository.EmergencyRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local-demo")
class SecurityAuthorizationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DisasterRepository disasterRepository;

    @Autowired
    private EmergencyRequestRepository emergencyRequestRepository;

        @Autowired
        private AppUserRepository appUserRepository;

        @Autowired
        private PasswordEncoder passwordEncoder;

    @BeforeEach
    void clearRecords() {
        emergencyRequestRepository.deleteAll();
        disasterRepository.deleteAll();
        appUserRepository.findAll().stream()
                .filter(account -> !"bhavik@admin".equalsIgnoreCase(account.getEmail()))
                .forEach(appUserRepository::delete);
    }

    @Test
    void communityRegistrationCreatesOnlyUserRoleAndLoginRestoresSession() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Avery User\",\"email\":\"AVERY@example.org\",\"password\":\"StrongPass123\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.email").value("avery@example.org"))
                .andExpect(content().string(not(containsString("StrongPass123"))));

        var loginResult = mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"avery@example.org\",\"password\":\"StrongPass123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("USER"))
                .andReturn();

        MockHttpSession session = (MockHttpSession) loginResult.getRequest().getSession(false);
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Avery User"));

        var savedUser = appUserRepository.findByEmailIgnoreCase("avery@example.org").orElseThrow();
        org.junit.jupiter.api.Assertions.assertNotEquals("StrongPass123", savedUser.getPasswordHash());
        org.junit.jupiter.api.Assertions.assertTrue(passwordEncoder.matches("StrongPass123", savedUser.getPasswordHash()));
    }

    @Test
    void localDemoAdminCredentialsAuthenticateWithUsername() throws Exception {
        var loginResult = mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"bhavik@admin\",\"password\":\"bhavik@12345678\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.email").value("bhavik@admin"))
                .andReturn();

        MockHttpSession session = (MockHttpSession) loginResult.getRequest().getSession(false);
        mockMvc.perform(get("/api/dashboard").session(session))
                .andExpect(status().isOk());
    }

    @Test
    void dashboardRequiresAdminRole() throws Exception {
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/dashboard").with(user("user@example.org").roles("USER")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/dashboard").with(user("admin@example.org").roles("ADMIN")))
                .andExpect(status().isOk());
    }

    @Test
    void usersCannotReadDisasterReports() throws Exception {
        mockMvc.perform(get("/api/disasters").with(user("user@example.org").roles("USER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void usersCanOnlyReadTheirOwnRequestsAndCannotChangeStatus() throws Exception {
        EmergencyRequest ownRequest = new EmergencyRequest();
        ownRequest.setName("Avery User");
        ownRequest.setPhone("555-0100");
        ownRequest.setLocation("North District");
        ownRequest.setDetails("Need drinking water");
        ownRequest.setRequesterEmail("avery@example.org");
        emergencyRequestRepository.save(ownRequest);

        EmergencyRequest anotherRequest = new EmergencyRequest();
        anotherRequest.setName("Sam Other");
        anotherRequest.setPhone("555-0199");
        anotherRequest.setLocation("South District");
        anotherRequest.setDetails("Need medical help");
        anotherRequest.setRequesterEmail("sam@example.org");
        emergencyRequestRepository.save(anotherRequest);

        mockMvc.perform(get("/api/emergency-requests").with(user("avery@example.org").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Need drinking water")))
                .andExpect(content().string(not(containsString("Need medical help"))));

        mockMvc.perform(put("/api/emergency-requests/{id}", ownRequest.getId())
                        .with(user("avery@example.org").roles("USER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVED\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void usersCanCreateRequestsButCannotChooseOwnerOrInitialStatus() throws Exception {
        mockMvc.perform(post("/api/emergency-requests")
                        .with(user("avery@example.org").roles("USER"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Avery\",\"phone\":\"555-0100\",\"location\":\"North District\",\"details\":\"Need water\",\"status\":\"RESOLVED\",\"requesterEmail\":\"admin@example.org\"}"))
                .andExpect(status().isCreated())
                .andExpect(content().string(containsString("avery@example.org")))
                .andExpect(content().string(containsString("OPEN")))
                .andExpect(content().string(not(containsString("admin@example.org"))));
    }
}