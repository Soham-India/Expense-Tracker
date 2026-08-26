import { apiSlice } from "@/store/api/apiSlice";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from "@/types/api";

export const authApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({ url: "auth/register", method: "POST", body }),
      invalidatesTags: ["User"],
    }),
    login: build.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({ url: "auth/login", method: "POST", body }),
      invalidatesTags: ["User"],
    }),
    me: build.query<UserResponse, void>({
      query: () => "auth/me",
      providesTags: ["User"],
    }),
  }),
});

export const { useRegisterMutation, useLoginMutation, useMeQuery } = authApi;
