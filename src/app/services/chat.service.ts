import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment.development';
import { Observable, Subject } from 'rxjs';
import { Chat } from '../models/chat';
import { Result } from '../models/result';
import { CreateChat } from '../models/create-chat';
import { Message } from '../models/message';
import { User } from '../models/user';
import { UpdateChatStatus } from '../models/update-chat-status';
import { AddParticipantRequest } from '../models/add-participant-request';
import { DeleteChat } from '../models/delete-chat';
import { LeaveGroupChat } from '../models/leave-group-chat';
import { ToggleMuteStatus } from '../models/toggle-mute-status';
import { EditMessage } from '../models/edit-message';
import { AddReaction } from '../models/add-reaction';
import { RemoveReaction } from '../models/remove-reaction';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private apiUrl: string = `${environment.ResUrl}/chat`;
  private initiateOneOnOneChatSubject = new Subject<User>(); 
  initiateOneOnOneChat$: Observable<User> = this.initiateOneOnOneChatSubject.asObservable();

  constructor(private http: HttpClient) { }

  getUserChats(
    userId: number, 
    pageNumber: number = 1, 
    pageSize: number = 20
  ): Observable<Result<Chat[]>> {
    const params = new HttpParams()
      .set('userId', userId.toString())
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());
  
    return this.http.get<Result<Chat[]>>(`${this.apiUrl}/user-chats`, { params });
  }
  createChat(dto: CreateChat): Observable<Result<Chat>> {
    const formData = new FormData();

    formData.append('name', dto.name ?? ''); // Use nullish coalescing operator
    formData.append('isGroup', String(dto.isGroup));
    formData.append('createdByUserId', String(dto.createdByUserId));

    dto.participantIds.forEach((id, index) => {
      formData.append(`participantIds[${index}]`, id.toString());
    });

    if (dto.avatarUrl) {
      formData.append('avatarUrl', dto.avatarUrl);
    }

    return this.http.post<Result<Chat>>(`${this.apiUrl}/create`, formData);
  }
  getChatMessages(
      chatId: number,
      lastMessageId: number | null = null, 
      pageSize: number = 50
    ): Observable<Result<Message[]>> { 
      let params = new HttpParams();
  
      if (lastMessageId !== null) {
        params = params.set('lastMessageId', lastMessageId.toString());
      }
      params = params.set('pageSize', pageSize.toString());
  
      return this.http.get<Result<Message[]>>(`${this.apiUrl}/${chatId}/messages`, { params });
  }
  getChatById(chatId: number, userId: number): Observable<Result<Chat>> {
    return this.http.get<Result<Chat>>(`${this.apiUrl}/${chatId}/forUser/${userId}`);
  }
  markMessagesAsRead(markAsReadDto: { chatId: number; lastReadMessageId: number }): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.apiUrl}/markasread`, markAsReadDto);
  }
  
  searchChats(
    searchTerm: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<Result<Chat[]>> {
    let params = new HttpParams()
      .set('searchTerm', searchTerm)
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<Result<Chat[]>>(`${this.apiUrl}/search`, { params });
  }

  initiateChatWithUser(user: User): void {
    this.initiateOneOnOneChatSubject.next(user);
  }
  updateChatStatus(dto: UpdateChatStatus): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${this.apiUrl}/${dto.chatId}/status`, dto);
  }

  updateChat(chatId: number, dto: { name?: string | null; avatarFile?: File | null }): Observable<Result<Chat>> {
    const formData = new FormData();
    formData.append('chatId', chatId.toString());

    if (dto.name !== undefined && dto.name !== null) {
      formData.append('name', dto.name);
    } else if (dto.name === null) {
    }
    if (dto.avatarFile) {
      formData.append('avatarFile', dto.avatarFile);
    }
    return this.http.put<Result<Chat>>(`${this.apiUrl}/${chatId}/update`, formData);
  }

  removeParticipant(chatId: number, userIdToRemove: number): Observable<Result<boolean>> {
    const url = `${this.apiUrl}/${chatId}/participants`; // <-- Corrected path
    return this.http.delete<Result<boolean>>(url, { body: { userIdToRemove: userIdToRemove } });
  }

  addParticipant(chatId: number, userIdToAdd: number): Observable<Result<Chat>> {
    const requestBody: AddParticipantRequest = { userIdToAdd: userIdToAdd };
    return this.http.post<Result<Chat>>(`${this.apiUrl}/${chatId}/participants`, requestBody);
  }


  toggleMuteStatus(dto: ToggleMuteStatus): Observable<Result<boolean>> {
      return this.http.post<Result<boolean>>(`${this.apiUrl}/toggle-mute`, dto);
  }
  
  leaveGroupChat(dto: LeaveGroupChat): Observable<Result<boolean>> {
      return this.http.post<Result<boolean>>(`${this.apiUrl}/leave-group`, dto);
  }

  deleteChat(dto: DeleteChat): Observable<Result<boolean>> {
      // For DELETE requests with a body, the body needs to be passed in an options object.
      return this.http.delete<Result<boolean>>(`${this.apiUrl}/delete-chat`, { body: dto });
  }

  deleteMessage(messageId: number, chatId: number): Observable<Result<boolean>> {
    const params = new HttpParams().set('chatId', chatId.toString());
    return this.http.delete<Result<boolean>>(`${this.apiUrl}/messages/${messageId}`, { params });
  }
  
  editMessage(dto: EditMessage): Observable<Result<Message>> {
    return this.http.put<Result<Message>>(`${this.apiUrl}/messages/${dto.messageId}`, dto);
  }

  addReaction(addReactionDto: AddReaction): Observable<Result<Message>> {
    return this.http.post<Result<Message>>(`${this.apiUrl}/messages/${addReactionDto.messageId}/reactions`, addReactionDto);
  }

  removeReaction(removeReactionDto: RemoveReaction): Observable<Result<Message>> {
    let params = new HttpParams();
    params = params.append('chatId', removeReactionDto.chatId.toString());
    params = params.append('reaction', removeReactionDto.reaction);

    return this.http.delete<Result<Message>>(`${this.apiUrl}/messages/${removeReactionDto.messageId}/reactions`, { params: params });
  }
}