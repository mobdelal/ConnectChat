import { User } from "./user";

export interface ChatParticipant {
    userId: number;
    username: string;
    avatarUrl?: string;
    isAdmin: boolean;
    joinedAt: string; 
    user:User;
    isMuted: boolean;
  }