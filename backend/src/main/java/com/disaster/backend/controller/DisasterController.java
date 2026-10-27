package com.disaster.backend.controller;

import java.util.List;

import com.disaster.backend.model.Disaster;
import com.disaster.backend.repository.DisasterRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/disasters")
public class DisasterController {

    private final DisasterRepository disasterRepository;

    public DisasterController(DisasterRepository disasterRepository) {
        this.disasterRepository = disasterRepository;
    }

    @GetMapping
    public List<Disaster> getAllDisasters() {
        return disasterRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Disaster> getDisaster(@PathVariable Long id) {
        return disasterRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Disaster> createDisaster(@RequestBody Disaster disaster) {
        disaster.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(disasterRepository.save(disaster));
    }

    @PutMapping("/{id}")
    public Disaster updateDisaster(@PathVariable Long id, @RequestBody Disaster updatedDisaster) {
        Disaster disaster = disasterRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Disaster not found"));

        disaster.setTitle(updatedDisaster.getTitle());
        disaster.setType(updatedDisaster.getType());
        disaster.setDescription(updatedDisaster.getDescription());
        disaster.setSeverity(updatedDisaster.getSeverity());
        disaster.setLocation(updatedDisaster.getLocation());
        disaster.setLatitude(updatedDisaster.getLatitude());
        disaster.setLongitude(updatedDisaster.getLongitude());
        return disasterRepository.save(disaster);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDisaster(@PathVariable Long id) {
        if (!disasterRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        disasterRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}