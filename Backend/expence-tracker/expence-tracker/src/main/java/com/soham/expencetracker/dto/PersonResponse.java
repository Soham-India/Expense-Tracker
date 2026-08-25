package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.PersonEntity;

import java.util.UUID;

public record PersonResponse(UUID id, String name, String contactInfo, boolean self, boolean archived) {

    public static PersonResponse from(PersonEntity entity) {
        return new PersonResponse(entity.getId(), entity.getName(), entity.getContactInfo(),
                entity.isSelf(), entity.isArchived());
    }
}
