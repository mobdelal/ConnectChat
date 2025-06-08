import { Chat } from "./chat";
import { User } from "./user";

export interface UserRelationshipStatus {
    blockedUsers: User[];
    rejectedChats: Chat[];
    totalBlockedUsers: number;
    totalRejectedChats: number;
}
