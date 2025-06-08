import { FileAttachmentCreate } from "./file-attachment-create";

export interface SendMessage {
    chatId: number;
    senderId: number;
    content?: string;
    attachments: FileAttachmentCreate[];
  }
  