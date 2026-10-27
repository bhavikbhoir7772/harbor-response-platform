package com.disaster.backend.repository;

import com.disaster.backend.model.Disaster;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DisasterRepository extends JpaRepository<Disaster, Long> {
}