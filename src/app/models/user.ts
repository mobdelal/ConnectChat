export interface User {
    id: number;
    username: string;
    avatarUrl?: string; 
    isOnline: boolean;
    lastSeen: Date; 
    receiveNotifications: boolean;
  }