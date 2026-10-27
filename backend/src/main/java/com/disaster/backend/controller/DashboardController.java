package com.disaster.backend.controller;

import java.util.Map;

import com.disaster.backend.repository.DisasterRepository;
import com.disaster.backend.repository.EmergencyRequestRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DisasterRepository disasterRepository;
    private final EmergencyRequestRepository emergencyRequestRepository;

    public DashboardController(
            DisasterRepository disasterRepository,
            EmergencyRequestRepository emergencyRequestRepository) {
        this.disasterRepository = disasterRepository;
        this.emergencyRequestRepository = emergencyRequestRepository;
    }

    @GetMapping
    public Map<String, Long> getDashboardSummary() {
        return Map.of(
                "totalDisasters", disasterRepository.count(),
                "totalEmergencyRequests", emergencyRequestRepository.count());
    }
}