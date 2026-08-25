package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.CreateCategoryRequest;
import com.soham.expencetracker.dto.CreateSubcategoryRequest;
import com.soham.expencetracker.dto.ReorderCategoriesRequest;
import com.soham.expencetracker.dto.UpdateCategoryRequest;
import com.soham.expencetracker.entity.CategoryEntity;
import com.soham.expencetracker.entity.CategoryScope;
import com.soham.expencetracker.entity.SubcategoryEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.ResourceInUseException;
import com.soham.expencetracker.repository.CategoryRepository;
import com.soham.expencetracker.repository.SubcategoryRepository;
import com.soham.expencetracker.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private SubcategoryRepository subcategoryRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CategoryService categoryService;

    @Test
    void create_savesCategory_withNextSortOrder() {
        when(categoryRepository.existsByUserIdAndNameIgnoreCase(USER_ID, "Groceries")).thenReturn(false);
        when(categoryRepository.countByUserId(USER_ID)).thenReturn(6L);
        when(userRepository.getReferenceById(USER_ID)).thenReturn(new UserEntity());
        when(categoryRepository.save(any(CategoryEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = categoryService.create(
                USER_ID, new CreateCategoryRequest("  Groceries  ", CategoryScope.ACTUAL));

        assertThat(response.name()).isEqualTo("Groceries");
        assertThat(response.scope()).isEqualTo(CategoryScope.ACTUAL);
        assertThat(response.sortOrder()).isEqualTo(6);

        ArgumentCaptor<CategoryEntity> captor = ArgumentCaptor.forClass(CategoryEntity.class);
        verify(categoryRepository).save(captor.capture());
        assertThat(captor.getValue().getName()).isEqualTo("Groceries");
    }

    @Test
    void create_duplicateName_throwsConflict() {
        when(categoryRepository.existsByUserIdAndNameIgnoreCase(USER_ID, "food")).thenReturn(true);

        assertThatThrownBy(() ->
                categoryService.create(USER_ID, new CreateCategoryRequest("food", CategoryScope.BOTH)))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void update_renameToSelfName_isAllowed() {
        CategoryEntity existing = ownedCategory("Food");
        when(categoryRepository.findByUserIdAndId(USER_ID, existing.getId())).thenReturn(Optional.of(existing));
        when(categoryRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(USER_ID, "Food", existing.getId()))
                .thenReturn(false);

        var response = categoryService.update(
                USER_ID, existing.getId(), new UpdateCategoryRequest("Food", CategoryScope.IDEAL, true));

        assertThat(response.scope()).isEqualTo(CategoryScope.IDEAL);
        assertThat(response.hidden()).isTrue();
    }

    @Test
    void update_renameToOtherCategoryName_throwsConflict() {
        CategoryEntity existing = ownedCategory("Food");
        when(categoryRepository.findByUserIdAndId(USER_ID, existing.getId())).thenReturn(Optional.of(existing));
        when(categoryRepository.existsByUserIdAndNameIgnoreCaseAndIdNot(USER_ID, "Travel", existing.getId()))
                .thenReturn(true);

        assertThatThrownBy(() ->
                categoryService.update(USER_ID, existing.getId(),
                        new UpdateCategoryRequest("Travel", CategoryScope.BOTH, false)))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void delete_inUse_translatesToResourceInUse() {
        CategoryEntity existing = ownedCategory("Food");
        when(categoryRepository.findByUserIdAndId(USER_ID, existing.getId())).thenReturn(Optional.of(existing));
        org.mockito.Mockito.doThrow(new DataIntegrityViolationException("fk"))
                .when(categoryRepository).delete(existing);

        assertThatThrownBy(() -> categoryService.delete(USER_ID, existing.getId()))
                .isInstanceOf(ResourceInUseException.class)
                .hasMessageContaining("hide it instead");
    }

    @Test
    void reorder_rejectsForeignCategoryId() {
        UUID foreignId = UUID.randomUUID();
        when(categoryRepository.findByUserIdAndId(USER_ID, foreignId)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                categoryService.reorder(USER_ID, new ReorderCategoriesRequest(List.of(foreignId))))
                .isInstanceOf(com.soham.expencetracker.exception.ResourceNotFoundException.class);
    }

    @Test
    void addSubcategory_duplicateWithinCategory_throwsConflict() {
        CategoryEntity existing = ownedCategory("Food");
        when(categoryRepository.findByUserIdAndId(USER_ID, existing.getId())).thenReturn(Optional.of(existing));
        when(subcategoryRepository.existsByCategoryIdAndNameIgnoreCase(existing.getId(), "lunch")).thenReturn(true);

        assertThatThrownBy(() ->
                categoryService.addSubcategory(USER_ID, existing.getId(), new CreateSubcategoryRequest("lunch")))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("in this category");
    }

    @Test
    void seedDefaults_createsSixCategoriesWithFoodSubcategories() {
        when(categoryRepository.countByUserId(any())).thenReturn(0L);
        when(categoryRepository.save(any(CategoryEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(subcategoryRepository.save(any(SubcategoryEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        categoryService.seedDefaults(user);

        ArgumentCaptor<CategoryEntity> categoryCaptor = ArgumentCaptor.forClass(CategoryEntity.class);
        verify(categoryRepository, org.mockito.Mockito.times(6)).save(categoryCaptor.capture());
        List<String> names = categoryCaptor.getAllValues().stream().map(CategoryEntity::getName).toList();
        assertThat(names).containsExactly("Food", "Travel", "Shopping", "Bills", "Entertainment", "Other");
    }

    private CategoryEntity ownedCategory(String name) {
        CategoryEntity category = new CategoryEntity();
        category.setId(UUID.randomUUID());
        category.setName(name);
        return category;
    }
}
