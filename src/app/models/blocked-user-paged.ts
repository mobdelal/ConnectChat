import { SingleBlockedUser } from "./blocked-user";

export interface BlockedUserPaged {
    items: SingleBlockedUser[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }