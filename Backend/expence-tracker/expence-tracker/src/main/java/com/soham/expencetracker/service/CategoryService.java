package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.CategoryResponse;
import com.soham.expencetracker.dto.CreateCategoryRequest;
import com.soham.expencetracker.dto.CreateSubcategoryRequest;
import com.soham.expencetracker.dto.ReorderCategoriesRequest;
import com.soham.expencetracker.dto.SubcategoryResponse;
import com.soham.expencetracker.dto.UpdateCategoryRequest;
import com.soham.expencetracker.dto.UpdateSubcategoryRequest;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.SubcategoryEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.ResourceInUseException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
import com.soham.expencetracker.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final SubcategoryRepository subcategoryRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<CategoryResponse> list(UUID userId) {
        Map<UUID, List<SubcategoryResponse>> subsByCategory =
                subcategoryRepository.findByCategoryUserIdOrderBySortOrderAscNameAsc(userId).stream()
                        .collect(Collectors.groupingBy(
                                sub -> sub.getCategory().getId(),
                                Collectors.mapping(SubcategoryResponse::from, Collectors.toList())));
        return categoryRepository.findByUserIdOrderBySortOrderAscNameAsc(userId).stream()
                .map(category -> toResponse(category, subsByCategory.getOrDefault(category.getId(), List.of())))
                .toList();
    }

    @Transactional
    public CategoryResponse create(UUID userId, CreateCategoryRequest request) {
        String name = request.name().trim();
        if (categoryRepository.existsByUserIdAndNameIgnoreCase(userId, name)) {
            throw new DuplicateResourceException("A category named '" + name + "' already exists");
        }
        CategoryEntity category = new CategoryEntity();
        category.setUser(userRepository.getReferenceById(userId));
        category.setName(name);
        category.setScope(request.scope());
        category.setSortOrder((int) categoryRepository.countByUserId(userId));
        return toResponse(categoryRepository.save(category), List.of());
    }

    @Transactional
    public CategoryResponse update(UUID userId, UUID categoryId, UpdateCategoryRequest request) {
        CategoryEntity category = getOwned(userId, categoryId);
        String name = request.name().trim();
        if (categoryRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(userId, name, categoryId)) {
            throw new DuplicateResourceException("A category named '" + name + "' already exists");
        }
        category.setName(name);
        category.setScope(request.scope());
        category.setHidden(request.hidden());
        return toResponse(category, subcategoriesOf(categoryId));
    }

    @Transactional
    public void reorder(UUID userId, ReorderCategoriesRequest request) {
        List<CategoryEntity> categories = request.categoryIds().stream()
                .map(id -> getOwned(userId, id))
                .toList();
        for (int i = 0; i < categories.size(); i++) {
            categories.get(i).setSortOrder(i);
        }
    }

    @Transactional
    public void delete(UUID userId, UUID categoryId) {
        CategoryEntity category = getOwned(userId, categoryId);
        try {
            categoryRepository.delete(category);
            categoryRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResourceInUseException(
                    "Category is referenced by transactions or subcategories and cannot be deleted; hide it instead");
        }
    }

    @Transactional
    public SubcategoryResponse addSubcategory(UUID userId, UUID categoryId, CreateSubcategoryRequest request) {
        CategoryEntity category = getOwned(userId, categoryId);
        String name = request.name().trim();
        if (subcategoryRepository.existsByCategoryIdAndNameIgnoreCase(categoryId, name)) {
            throw new DuplicateResourceException(
                    "A subcategory named '" + name + "' already exists in this category");
        }
        SubcategoryEntity subcategory = new SubcategoryEntity();
        subcategory.setCategory(category);
        subcategory.setName(name);
        subcategory.setSortOrder((int) subcategoryRepository.countByCategoryId(categoryId));
        return SubcategoryResponse.from(subcategoryRepository.save(subcategory));
    }

    @Transactional
    public SubcategoryResponse updateSubcategory(UUID userId, UUID subcategoryId, UpdateSubcategoryRequest request) {
        SubcategoryEntity subcategory = getOwnedSubcategory(userId, subcategoryId);
        String name = request.name().trim();
        if (subcategoryRepository.existsByCategoryIdAndNameIgnoreCaseAndIdNot(
                subcategory.getCategory().getId(), name, subcategoryId)) {
            throw new DuplicateResourceException(
                    "A subcategory named '" + name + "' already exists in this category");
        }
        subcategory.setName(name);
        subcategory.setHidden(request.hidden());
        return SubcategoryResponse.from(subcategory);
    }

    @Transactional
    public void deleteSubcategory(UUID userId, UUID subcategoryId) {
        SubcategoryEntity subcategory = getOwnedSubcategory(userId, subcategoryId);
        try {
            subcategoryRepository.delete(subcategory);
            subcategoryRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ResourceInUseException(
                    "Subcategory is referenced by transactions and cannot be deleted; hide it instead");
        }
    }

    /**
     * Seeds the default classification set for a brand-new account
     * (PRD §9: Food, Travel, Shopping, Bills, Entertainment, Other with
     * fast-entry Food subcategories). Called during registration.
     */
    @Transactional
    public void seedDefaults(UserEntity user) {
        seedCategory(user, "Food", "Lunch", "Dinner", "Coffee", "Delivery");
        seedCategory(user, "Travel");
        seedCategory(user, "Shopping");
        seedCategory(user, "Bills");
        seedCategory(user, "Entertainment");
        seedCategory(user, "Other");
    }

    private void seedCategory(UserEntity user, String categoryName, String... subcategoryNames) {
        CategoryEntity category = new CategoryEntity();
        category.setUser(user);
        category.setName(categoryName);
        category.setSortOrder((int) categoryRepository.countByUserId(user.getId()));
        category = categoryRepository.save(category);
        for (int i = 0; i < subcategoryNames.length; i++) {
            SubcategoryEntity subcategory = new SubcategoryEntity();
            subcategory.setCategory(category);
            subcategory.setName(subcategoryNames[i]);
            subcategory.setSortOrder(i);
            subcategoryRepository.save(subcategory);
        }
    }

    private CategoryEntity getOwned(UUID userId, UUID categoryId) {
        return categoryRepository.findByUserIdAndId(userId, categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
    }

    private SubcategoryEntity getOwnedSubcategory(UUID userId, UUID subcategoryId) {
        return subcategoryRepository.findByIdAndCategoryUserId(subcategoryId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Subcategory not found"));
    }

    private List<SubcategoryResponse> subcategoriesOf(UUID categoryId) {
        return subcategoryRepository.findByCategoryIdOrderBySortOrderAscNameAsc(categoryId).stream()
                .map(SubcategoryResponse::from)
                .toList();
    }

    private CategoryResponse toResponse(CategoryEntity category, List<SubcategoryResponse> subcategories) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getScope(),
                category.isHidden(),
                category.getSortOrder(),
                subcategories);
    }
}
