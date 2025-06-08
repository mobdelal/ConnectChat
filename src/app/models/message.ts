import { FileAttachment } from "./file-attachment";
import { MessageReaction } from "./message-reaction";

export interface Message {
    id: number;
    chatId: number;
    senderId: number;
    senderUsername: string;
    senderAvatarUrl: string;
    content?: string | null;
    sentAt: string;
    editedAt?: string | null;
    isEdited: boolean;
    isDeleted: boolean;
    isSystemMessage: boolean;
    attachments: FileAttachment[];
    reactions: MessageReaction[];
  }