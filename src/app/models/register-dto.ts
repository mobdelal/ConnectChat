// src/app/models/register-dto.ts
export interface RegisterDTO {
    userName: string;
    email: string;
    password: string;
    avatar?: File | null; 
  }