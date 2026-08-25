package com.soham.expencetracker.dto;

import com.soham.expencetracker.entity.PersonEntity;
import com.soham.expencetracker.entity.SplitGroupStatus;

import java.util.List;
import java.util.UUID;

public record GroupResponse(
        UUID id,
        String name,
        String description,
        SplitGroupStatus status,
        List<MemberResponse> members) {

    public record MemberResponse(UUID personId, String personName, boolean self) {

        public static MemberResponse from(PersonEntity person) {
            return new MemberResponse(person.getId(), person.getName(), person.isSelf());
        }
    }
}
