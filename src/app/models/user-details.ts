export interface UserDetails {
    id: number;
    username: string;
    email: string;
    avatarUrl?: string;
    isOnline: boolean;
    lastSeen: string; 
    blockedUsersIds: number[];
    receiveNotifications: boolean;

  }
  