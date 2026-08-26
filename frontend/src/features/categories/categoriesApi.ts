import { apiSlice } from "@/store/api/apiSlice";
import type {
  CategoryResponse,
  CreateCategoryRequest,
  CreateSubcategoryRequest,
  ReorderCategoriesRequest,
  UpdateCategoryRequest,
  UpdateSubcategoryRequest,
} from "@/types/api";

export const categoriesApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getCategories: build.query<CategoryResponse[], void>({
      query: () => "categories",
      providesTags: ["Categories"],
    }),
    createCategory: build.mutation<CategoryResponse, CreateCategoryRequest>({
      query: (body) => ({ url: "categories", method: "POST", body }),
      invalidatesTags: ["Categories"],
    }),
    updateCategory: build.mutation<
      CategoryResponse,
      { id: string; body: UpdateCategoryRequest }
    >({
      query: ({ id, body }) => ({
        url: `categories/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Categories"],
    }),
    reorderCategories: build.mutation<void, ReorderCategoriesRequest>({
      query: (body) => ({ url: "categories/reorder", method: "PUT", body }),
      invalidatesTags: ["Categories"],
    }),
    deleteCategory: build.mutation<void, string>({
      query: (id) => ({ url: `categories/${id}`, method: "DELETE" }),
      // 409 when referenced - the UI tells the user to hide instead (§3.2).
      invalidatesTags: ["Categories"],
    }),
    createSubcategory: build.mutation<
      CategoryResponse["subcategories"][number],
      { categoryId: string; body: CreateSubcategoryRequest }
    >({
      query: ({ categoryId, body }) => ({
        url: `categories/${categoryId}/subcategories`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Categories"],
    }),
    updateSubcategory: build.mutation<
      void,
      { id: string; body: UpdateSubcategoryRequest }
    >({
      query: ({ id, body }) => ({
        url: `subcategories/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Categories"],
    }),
    deleteSubcategory: build.mutation<void, string>({
      query: (id) => ({ url: `subcategories/${id}`, method: "DELETE" }),
      invalidatesTags: ["Categories"],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useReorderCategoriesMutation,
  useDeleteCategoryMutation,
  useCreateSubcategoryMutation,
  useUpdateSubcategoryMutation,
  useDeleteSubcategoryMutation,
} = categoriesApi;
