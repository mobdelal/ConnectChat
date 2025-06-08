import { ChatParticipant } from "./chat-participant";
import { Message } from "./message";

export interface Chat {
    id: number;
    name: string;
    avatarUrl?: string;
    isGroup: boolean;
    createdAt: string; 
    participants: ChatParticipant[];
    messages: Message[];
    unreadCount: number; 
    lastMessage?: Message;
    status: ChatStatus;
    createdByUserId: number;
    isMutedForCurrentUser: boolean;
}
export enum ChatStatus {
    Pending = 0,
    Active = 1,
    Rejected = 2,
  }