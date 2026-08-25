package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.CategoryResponse;
import com.soham.expencetracker.dto.CreateCategoryRequest;
import com.soham.expencetracker.dto.CreateSubcategoryRequest;
import com.soham.expencetracker.dto.ReorderCategoriesRequest;
import com.soham.expencetracker.dto.SubcategoryResponse;
import com.soham.expencetracker.dto.UpdateCategoryRequest;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    public List<CategoryResponse> list(@AuthenticationPrincipal AuthenticatedUser principal) {
        return categoryService.list(principal.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse create(@AuthenticationPrincipal AuthenticatedUser principal,
                                   @Valid @RequestBody CreateCategoryRequest request) {
        return categoryService.create(principal.id(), request);
    }

    @PutMapping("/{categoryId}")
    public CategoryResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                   @PathVariable UUID categoryId,
                                   @Valid @RequestBody UpdateCategoryRequest request) {
        return categoryService.update(principal.id(), categoryId, request);
    }

    @PutMapping("/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@AuthenticationPrincipal AuthenticatedUser principal,
                        @Valid @RequestBody ReorderCategoriesRequest request) {
        categoryService.reorder(principal.id(), request);
    }

    @DeleteMapping("/{categoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID categoryId) {
        categoryService.delete(principal.id(), categoryId);
    }

    @PostMapping("/{categoryId}/subcategories")
    @ResponseStatus(HttpStatus.CREATED)
    public SubcategoryResponse addSubcategory(@AuthenticationPrincipal AuthenticatedUser principal,
                                              @PathVariable UUID categoryId,
                                              @Valid @RequestBody CreateSubcategoryRequest request) {
        return categoryService.addSubcategory(principal.id(), categoryId, request);
    }
}
