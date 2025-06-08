import { SingleBlockingUser } from "./blocking-user";

export interface BlockingUserPaged {
  items: SingleBlockingUser[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}