export interface Result<T> {
    isSuccess: boolean;
    errorMessage?: string | null;
    data?: T | null;
  }
  