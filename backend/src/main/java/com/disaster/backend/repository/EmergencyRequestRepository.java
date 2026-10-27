package com.disaster.backend.repository;

import com.disaster.backend.model.EmergencyRequest;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmergencyRequestRepository extends JpaRepository<EmergencyRequest, Long> {
	java.util.List<EmergencyRequest> findAllByRequesterEmailOrderByCreatedAtDesc(String requesterEmail);
}