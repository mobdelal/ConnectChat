// src/app/services/signalr.service.ts
import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment.development';
import { SendMessage } from '../models/send-message';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { UserService } from './user.service';
import { Message } from '../models/message';
import { Chat } from '../models/chat'; // Import Chat model
import { UserTypingStatus } from '../models/user-typing-status';
import { MuteStatusUpdate } from '../models/mute-status-update'; // <-- IMPORT THIS!
import { UserProfileUpdatePayload } from '../models/user-profile-update-payload';

@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private hubConnection!: signalR.HubConnection;
  private listenersRegistered: boolean = false;

  private _messageReceived = new BehaviorSubject<Message | null>(null);
  public messageReceived$: Observable<Message | null> = this._messageReceived.asObservable();

  private _chatCreated = new Subject<Chat | null>();
  public chatCreated$: Observable<Chat | null> = this._chatCreated.asObservable();

  private _chatStatusUpdated = new Subject<Chat>();
  public chatStatusUpdated$: Observable<Chat> = this._chatStatusUpdated.asObservable();

  private _systemMessageReceived = new Subject<Message>();
  public systemMessageReceived$: Observable<Message> = this._systemMessageReceived.asObservable();

  private _chatUpdated = new Subject<Chat>();
  public chatUpdated$: Observable<Chat> = this._chatUpdated.asObservable();

  private _userTypingStatus = new Subject<UserTypingStatus>();
  public userTypingStatus$: Observable<UserTypingStatus> = this._userTypingStatus.asObservable();

  private _chatJoined = new Subject<Chat>();
  public chatJoined$: Observable<Chat> = this._chatJoined.asObservable();

  private _chatLeft = new Subject<number>();
  public chatLeft$: Observable<number> = this._chatLeft.asObservable();

  private _messageDeleted = new Subject<{ messageId: number; chatId: number }>();
  public messageDeleted$: Observable<{ messageId: number; chatId: number }> = this._messageDeleted.asObservable();

  private _messageEdited = new Subject<Message>();
  public messageEdited$: Observable<Message> = this._messageEdited.asObservable();

  private _messageReactionAdded = new Subject<Message>();
  public messageReactionAdded$: Observable<Message> = this._messageReactionAdded.asObservable();

  private _messageReactionRemoved = new Subject<Message>();
  public messageReactionRemoved$: Observable<Message> = this._messageReactionRemoved.asObservable();

  private _chatMuteStatusUpdated = new BehaviorSubject<MuteStatusUpdate | null>(null);
  public chatMuteStatusUpdated$: Observable<MuteStatusUpdate | null> = this._chatMuteStatusUpdated.asObservable();

  private _userProfileUpdated = new Subject<UserProfileUpdatePayload>();
  public userProfileUpdated$: Observable<UserProfileUpdatePayload> = this._userProfileUpdated.asObservable();
  
  constructor(private userService: UserService) { }

  public startConnection(): void {
    const token = this.userService.getToken();

    if (this.hubConnection && this.hubConnection.state !== signalR.HubConnectionState.Disconnected) {
      console.log('SignalR: Connection already exists or is connecting. Not creating a new one.');
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.ImageLinl}/chathub`, {
        accessTokenFactory: () => token || '',
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    if (!this.listenersRegistered) {
      this.addHubListeners();
      this.listenersRegistered = true;
    }

    this.hubConnection.onclose(error => {
      console.error('SignalR connection closed:', error);
      this.listenersRegistered = false;
    });

    this.hubConnection
      .start()
      .then(() => {
        console.log('SignalR connection started');
      })
      .catch(err => console.error('SignalR connection error:', err));
  }

  private addHubListeners(): void {
    this.hubConnection.on('ReceiveMessage', (message: Message) => {
      console.log('New message received (from Hub.on):', message);
      this._messageReceived.next(message);
    });

    this.hubConnection.on('ReceiveMessageError', (error: string) => {
      console.error('Message error from hub:', error);
    });

    this.hubConnection.on('ChatCreated', (chat: Chat) => {
      console.log('New chat created (from Hub.on):', chat);
      this._chatCreated.next(chat);
    });

    this.hubConnection.on('UserJoinedChatGroup', (chatId: number) => {
      console.log(`Successfully joined chat group: Chat-${chatId}`);
    });

    this.hubConnection.on('ChatStatusUpdated', (updatedChat: Chat) => {
      console.log('Chat Status Updated via SignalR:', updatedChat);
      this._chatStatusUpdated.next(updatedChat);
    });

    this.hubConnection.on('ReceiveSystemMessage', (message: Message) => {
      console.log('System Message Received via SignalR:', message);
      this._systemMessageReceived.next(message);
    });

    this.hubConnection.on('ChatUpdated', (updatedChat: Chat) => {
      console.log('Chat Updated via SignalR:', updatedChat);
      this._chatUpdated.next(updatedChat);
    });

    this.hubConnection.on('UserTyping', (data: UserTypingStatus) => {
      console.log('User is typing:', data);
      this._userTypingStatus.next({ ...data, isTyping: true });
    });

    this.hubConnection.on('UserStoppedTyping', (data: UserTypingStatus) => {
      console.log('User stopped typing:', data);
      this._userTypingStatus.next({ ...data, isTyping: false });
    });

    this.hubConnection.on('ChatJoined', (chat: Chat) => {
      console.log('Chat Joined via SignalR (with chat object):', chat);
      this._chatJoined.next(chat);
    });

    this.hubConnection.on('ChatLeft', (chatId: number) => {
      console.log('Chat Left via SignalR (chat ID):', chatId);
      this._chatLeft.next(chatId);
    });

    this.hubConnection.on('MessageDeleted', (messageId: number, chatId: number) => {
      console.log(`Message ${messageId} deleted in chat ${chatId} via SignalR.`);
      this._messageDeleted.next({ messageId, chatId });
    });

    this.hubConnection.on('MessageEdited', (updatedMessage: Message) => {
      console.log('Message edited via SignalR:', updatedMessage);
      this._messageEdited.next(updatedMessage);
    });

    this.hubConnection.on('MessageReactionAdded', (updatedMessage: Message) => {
      console.log('Message reaction added via SignalR:', updatedMessage);
      this._messageReactionAdded.next(updatedMessage);
    });

    this.hubConnection.on('MessageReactionRemoved', (updatedMessage: Message) => {
      console.log('Message reaction removed via SignalR:', updatedMessage);
      this._messageReactionRemoved.next(updatedMessage);
    });

    this.hubConnection.on('ChatMuteStatusUpdated', (data: MuteStatusUpdate) => {
      console.log('Chat mute status updated via SignalR:', data);
      this._chatMuteStatusUpdated.next(data);
    });

    this.hubConnection.on('UserProfileUpdated', (payload: UserProfileUpdatePayload) => {
      console.log(`SignalR: UserProfileUpdated received for User ID ${payload.userId}, ReceiveNotifications: ${payload.receiveNotifications}`);
      this._userProfileUpdated.next(payload);
    });
  }

  public onReceiveMessage(): Observable<Message | null> {
    return this.messageReceived$;
  }

  public onChatJoined(): Observable<Chat> {
    return this.chatJoined$;
  }
  public onChatLeft(): Observable<number> {
    return this.chatLeft$;
  }

  public onChatCreated(): Observable<Chat | null> {
    return this.chatCreated$;
  }

  public onChatStatusUpdated(): Observable<Chat> {
    return this.chatStatusUpdated$;
  }

  public onSystemMessageReceived(): Observable<Message> {
    return this.systemMessageReceived$;
  }

  public onMessageReactionAdded(): Observable<Message> {
    return this.messageReactionAdded$;
  }

  public onMessageReactionRemoved(): Observable<Message> {
    return this.messageReactionRemoved$;
  }

  public onChatUpdated(): Observable<Chat> {
    return this.chatUpdated$;
  }

  public onUserTypingStatus(): Observable<UserTypingStatus> {
    return this.userTypingStatus$;
  }

  public onMessageDeleted(): Observable<{ messageId: number; chatId: number }> {
    return this.messageDeleted$;
  }

  public onMessageEdited(): Observable<Message> {
    return this.messageEdited$;
  }

  public onChatMuteStatusUpdated(): Observable<MuteStatusUpdate | null> {
    return this.chatMuteStatusUpdated$;
  }

  public sendMessage(message: SendMessage): void {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      console.warn('Cannot send message: Not connected to SignalR');
      return;
    }

    this.hubConnection.invoke('SendMessage', message)
      .catch(err => console.error('Error invoking SendMessage:', err));
  }

  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop()
        .then(() => {
          console.log('SignalR connection stopped');
          this.listenersRegistered = false;
        })
        .catch(err => console.error('Error stopping SignalR:', err));
    }
  }

  public joinChatGroup(chatId: number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      console.warn('Cannot join group: Not connected to SignalR');
      return Promise.reject('Not connected');
    }
    return this.hubConnection.invoke('JoinChatGroup', chatId)
      .catch(err => console.error(`Error joining chat group ${chatId}:`, err));
  }

  public leaveChatGroup(chatId: number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      console.warn('Cannot leave group: Not connected to SignalR');
      return Promise.reject('Not connected');
    }
    return this.hubConnection.invoke('LeaveChatGroup', chatId)
      .catch(err => console.error(`Error leaving chat group ${chatId}:`, err));
  }

  public sendTypingNotification(chatId: number, userId: number): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('UserTyping', chatId, userId)
        .catch(err => console.error('Error sending typing notification:', err));
    }
  }

  public sendStoppedTypingNotification(chatId: number, userId: number): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('UserStoppedTyping', chatId, userId)
        .catch(err => console.error('Error sending stopped typing notification:', err));
    }
  }

  public onUserProfileUpdated(): Observable<UserProfileUpdatePayload> {
    return this.userProfileUpdated$;
  }
}