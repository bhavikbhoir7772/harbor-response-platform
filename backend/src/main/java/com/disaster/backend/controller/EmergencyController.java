package com.disaster.backend.controller;

import java.util.List;

import com.disaster.backend.model.EmergencyRequest;
import com.disaster.backend.repository.EmergencyRequestRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;

@RestController
@RequestMapping("/api/emergency-requests")
public class EmergencyController {

    private final EmergencyRequestRepository emergencyRequestRepository;

    public EmergencyController(EmergencyRequestRepository emergencyRequestRepository) {
        this.emergencyRequestRepository = emergencyRequestRepository;
    }

    @GetMapping
    public List<EmergencyRequest> getAllRequests(@AuthenticationPrincipal UserDetails user) {
        if (user.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"))) {
            return emergencyRequestRepository.findAll();
        }
        return emergencyRequestRepository.findAllByRequesterEmailOrderByCreatedAtDesc(user.getUsername());
    }

    @GetMapping("/{id}")
        public ResponseEntity<EmergencyRequest> getRequest(@PathVariable Long id, @AuthenticationPrincipal UserDetails user) {
        return emergencyRequestRepository.findById(id)
            .filter(request -> user.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"))
                || user.getUsername().equals(request.getRequesterEmail()))
            .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<EmergencyRequest> createRequest(
            @RequestBody EmergencyRequest request,
            @AuthenticationPrincipal UserDetails user) {
        request.setId(null);
        request.setRequesterEmail(user.getUsername());
        request.setStatus("OPEN");
        return ResponseEntity.status(HttpStatus.CREATED).body(emergencyRequestRepository.save(request));
    }

    @PutMapping("/{id}")
    public EmergencyRequest updateRequest(@PathVariable Long id, @RequestBody EmergencyRequest updatedRequest) {
        EmergencyRequest request = emergencyRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Emergency request not found"));

        request.setName(updatedRequest.getName());
        request.setPhone(updatedRequest.getPhone());
        request.setDetails(updatedRequest.getDetails());
        request.setLocation(updatedRequest.getLocation());
        request.setStatus(updatedRequest.getStatus());
        return emergencyRequestRepository.save(request);
    }
}