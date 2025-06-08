export interface CreateChat {
    name: string | null; // <-- Changed to allow null
    isGroup: boolean;
    participantIds: number[];
    createdByUserId: number;
    avatarUrl?: File | null;
  }