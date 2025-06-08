import { ChatStatus } from "./chat";

export interface UpdateChatStatus {
    chatId: number;
    newStatus: ChatStatus;
    userId: number;
}
