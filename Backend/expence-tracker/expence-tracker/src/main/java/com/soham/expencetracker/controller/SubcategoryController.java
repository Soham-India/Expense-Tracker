package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.SubcategoryResponse;
import com.soham.expencetracker.dto.UpdateSubcategoryRequest;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/subcategories")
@RequiredArgsConstructor
public class SubcategoryController {

    private final CategoryService categoryService;

    @PutMapping("/{subcategoryId}")
    public SubcategoryResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                      @PathVariable UUID subcategoryId,
                                      @Valid @RequestBody UpdateSubcategoryRequest request) {
        return categoryService.updateSubcategory(principal.id(), subcategoryId, request);
    }

    @DeleteMapping("/{subcategoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID subcategoryId) {
        categoryService.deleteSubcategory(principal.id(), subcategoryId);
    }
}
