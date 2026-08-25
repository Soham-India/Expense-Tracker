package com.soham.expencetracker.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record IdealMonthResponse(UUID id, String month, BigDecimal startingIncoming) {
}
