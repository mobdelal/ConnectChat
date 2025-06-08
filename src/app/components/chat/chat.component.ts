import { Component, ElementRef, OnInit, ViewChild, OnDestroy, AfterViewChecked, HostListener, Renderer2, Inject, ChangeDetectorRef } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../services/user.service';
import { Chat, ChatStatus } from '../../models/chat';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CreateChat } from '../../models/create-chat';
import { environment } from '../../../environments/environment.development';
import { Message } from '../../models/message';
import { Result } from '../../models/result';
import { SignalrService } from '../../services/signalr.service';
import { FileAttachmentCreate } from '../../models/file-attachment-create';
import { SendMessage } from '../../models/send-message';
import { Subject, Subscription, debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs';
import { HeaderComponent } from "../header/header.component";
import { User } from '../../models/user';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { UpdateChatStatus } from '../../models/update-chat-status';
import { HeaderService } from '../../services/header.service';
import { HttpErrorResponse } from '@angular/common/http';
import { UpdateChat } from '../../models/update-chat';
import { ChatParticipant } from '../../models/chat-participant';
import { UserTypingStatus } from '../../models/user-typing-status';
import Swal from 'sweetalert2';
import { DeleteChat } from '../../models/delete-chat';
import { LeaveGroupChat } from '../../models/leave-group-chat';
import { ToggleMuteStatus } from '../../models/toggle-mute-status';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { OverlayModule } from '@angular/cdk/overlay';
import { UserDetails } from '../../models/user-details';
import { EditMessage } from '../../models/edit-message';
import { RemoveReaction } from '../../models/remove-reaction';
import { AddReaction } from '../../models/add-reaction';
import { MuteStatusUpdate } from '../../models/mute-status-update';
import { UserProfileUpdatePayload } from '../../models/user-profile-update-payload';



@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, OverlayModule, PickerModule, PickerModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef; // For active chat messages
  @ViewChild('chatListScrollContainer') private chatListScrollContainer!: ElementRef; // For the main chat list (sidebar)
  @ViewChild('fileInput') private fileInputRef!: ElementRef;
  @ViewChild('createChatFormRef') createChatFormRef!: NgForm;
  @ViewChild('userSearchScrollContainer') private userSearchScrollContainer!: ElementRef; // For user search infinite scroll
  @ViewChild('addMemberSearchScrollContainer') addMemberSearchScrollContainer!: ElementRef;
  @ViewChild('messageInput') messageInput: ElementRef | undefined; // Make it optional with '| undefined'

  imageBaseUrl = environment.ImageLinl;
  chats: Chat[] = [];
  activeChat: Chat | null = null;
  searchTerm: string = ''; 
  showCreateChatForm = false;
  currentPage = 1; 
  pageSize = 15; // Increased for better scroll experience, adjust as needed
  loading = false; // General loading for main chat list and chat search
  allLoaded = false; // For main chat list (all chats loaded)
  currentUser: UserDetails | null = null;
  loadingMessages = false;
  allMessagesLoaded = false;
  private initialMessageLoadDone = false;
  private previousScrollHeight = 0;
  searchResults: Chat[] = [];
  isSearching: boolean = false; 
  chatSearchPageNumber: number = 1;
  allChatSearchResultsLoaded: boolean = false; 
  private searchSubject = new Subject<string>();
  private chatSearchSubscription: Subscription | undefined;
  searchUsersTerm: string = '';
  searchUsersResults: User[] = [];
  selectedParticipants: User[] = [];
  isSearchingUsers: boolean = false;
  userSearchPageNumber: number = 1;
  userSearchPageSize: number = 10;
  allUsersLoaded: boolean = false; 
  private userSearchSubject = new Subject<string>();
  private userSearchSubscription: Subscription | undefined;
  private chatUpdatedSubscription: Subscription | undefined;
  showEmojiPicker: boolean = false;
  private unsubscribeDocumentClickListener: (() => void) | undefined;

  selectedFile: File | null = null;
  errorMessage: string | null = null;
  newChat = {
    name: '',
    isGroup: false,
  };
  attachments: FileAttachmentCreate[] = [];
  sendMessageDto: SendMessage = {
    chatId: 0,
    senderId: 0,
    content: '',
    attachments: []
  };
  currentUserId: number = 0;
  private routerSubscription!: Subscription; // Added
  private resizeSubscription!: Subscription;
  private chatMessageSubscription: Subscription | undefined;
  private chatCreatedSubscription: Subscription | undefined;
  private chatStatusUpdatedSubscription!: Subscription; 
  private systemMessageSubscription!: Subscription;

  ChatStatus = ChatStatus;
  isChatAreaVisibleOnMobile: boolean = false;
  isLoadingChat: boolean = false; 
  isVisible = true; 
  private headerSubscription!: Subscription;
  showChatUpdateModal: boolean = false;
  activeChatUpdateTab: string = 'info'; 
  addMemberSearchTerm: string = '';
  searchAddMembersResults: User[] = [];
  private searchMembersSubject = new Subject<string>();
  editChatForm: { name: string | null; avatarFile: File | null } = {
    name: null,
    avatarFile: null
  };
  currentChatAvatarPreviewUrl: string | null = null;

  chatUpdateMessage: string | null = null;
  chatUpdateError: string | null = null;
  private addMemberSearchSubscription: Subscription | null = null;
  private addMemberSearchSubject = new Subject<string>();
  private chatJoinedSubscription: Subscription| null = null;
  isSearchingAddMembers: boolean = false;
  addMemberSearchPageNumber: number = 1;
  addMemberSearchPageSize: number = 10; 
  allAddMembersLoaded: boolean = false;
  isAddingMember: boolean = false; 
  userToAddId: number | null = null;

  //user typing 
  typingUsers: { [chatId: number]: UserTypingStatus[] } = {};
  private typingTimeout: any;
  private isTypingSent: boolean = false;
  private typingNotificationDelayMs = 2000; // Time to wait after last key press before sending "stopped typing"
  private typingThrottleTimeMs = 1000; // How often to send "is typing" status
  private typingActivitySubject = new Subject<void>();
  private typingSubscription: Subscription | undefined;
  private chatLeftSubscription: Subscription | undefined; 
  private userTypingStatusSubscription: Subscription | undefined;

    // Properties for One-on-One Chat Info Modal (NEWLY ADDED/CLARIFIED)
  showOneOnOneChatInfoModal: boolean = false;
  otherParticipant: ChatParticipant | null = null;
  isOtherUserBlocked: boolean = false;
  blockUnblockMessage: string | null = null;
  blockUnblockError: string | null = null;

  muteStatusMessage: string | null = null;
  muteStatusError: string | null = null;
  leaveGroupMessage: string | null = null;
  leaveGroupError: string | null = null;
  deleteChatMessage: string | null = null;
  deleteChatError: string | null = null;
  private resizeSubjectDebouncer = new Subject<Event | null>();

  basicEmojis = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', 
    '😋', '😎', '😍', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤔',
    '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯',
    '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓',
    '😔', '😕', '🙃', '🤑', '😲', '🙁', '😖', '😞', '😟', '😤',
    '😢', '😭', '😦', '😧', '😨', '😩', '😬', '😰', '😱', '😳',
    '😵', '😡', '😠', '😷', '🤒', '🤕', '🤢', '🤧', '😇', '🤠',
    '🤡', '🤥', '🤓', '😈', '👿', '👹', '👺', '💀', '👻', '👽',
    '🤖', '💩', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
    '😾', '👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👵', '🧓',
    '👴', '👲', '👳', '🧕', '👮', '👷', '💂', '🕵️', '👩⚕️', '👨⚕️',
    '👩🎓', '👨🎓', '👩🏫', '👨🏫', '👩⚖️', '👨⚖️', '👩🌾', '👨🌾',
    '👩🍳', '👨🍳', '👩🔧', '👨🔧', '👩🏭', '👨🏭', '👩💼', '👨💼',
    '👩🔬', '👨🔬', '👩💻', '👨💻', '👩🎤', '👨🎤', '👩🎨', '👨🎨',
    '👩✈️', '👨✈️', '👩🚀', '👨🚀', '👩🚒', '👨🚒', '👶', '👧', '🧒'
  ];
  isCurrentUserAdmin: boolean = false;
  private messageDeletedSubscription: Subscription | undefined;
  private messageEditedSubscription: Subscription | undefined;

  messageReactionAddedSubscription!: Subscription; 
  messageReactionRemovedSubscription!: Subscription;

  showEmojiPickerForMessageId: number | null = null;
  availableEmojis: string[] = ['👍', '❤️', '😂', '😢', '😡', '🙏']; 
  hoveredMessageId: number | null = null;
  editingMessageId: number | null = null;
  editedMessageContent: string = '';

  private chatMuteStatusSubscription: Subscription | undefined; 
  private userProfileUpdatedSubscription: Subscription | undefined; // NEW subscription
  private initialUserLoadSubscription: Subscription | undefined;






  constructor(
    private userService: UserService,
    private chatService: ChatService,
    private signalRService: SignalrService,
    private snackBar: MatSnackBar,
    private router: Router,  
    private route: ActivatedRoute,   
    private renderer: Renderer2,
    private headerService: HeaderService,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document,
    ) {
    const senderId = this.userService.getUserIdFromToken();
    if (senderId) {
      this.currentUserId = senderId;
      this.sendMessageDto.senderId = senderId;
    }
  }
  @HostListener('window:resize', ['$event'])
  onResize(event: Event | null): void {
    this.resizeSubjectDebouncer.next(event);
  }

  playNotificationSound(): void {
    const audio = new Audio('assets/sounds/notification.wav');
    console.log("notifacation played");
    
    audio.play().catch(error => console.error('Error playing notification sound:', error));
    
  }
  
  toggleEmojiPicker(event: MouseEvent): void {
    event.stopPropagation(); // Prevent the document click listener from immediately closing it
    this.showEmojiPicker = !this.showEmojiPicker;
    console.log(this.showEmojiPicker);
    

    if (this.showEmojiPicker) {
      setTimeout(() => {
        this.unsubscribeDocumentClickListener = this.renderer.listen(
          'document',
          'click',
          this.documentClickListener // Pass the method reference
        );
      }, 0);
    } else {
      // If picker is hidden, remove the document click listener
      if (this.unsubscribeDocumentClickListener) {
        this.unsubscribeDocumentClickListener(); // Call the stored unsubscribe function
        this.unsubscribeDocumentClickListener = undefined; // Clear the reference
      }
    }
  }

  addEmoji(emoji: string): void {
    if (this.sendMessageDto.content === null || this.sendMessageDto.content === undefined) {
      this.sendMessageDto.content = '';
    }
    this.sendMessageDto.content += emoji;
    this.onMessageInput();

    if (this.messageInput) {
      this.messageInput.nativeElement.focus();
    }
  }

  private documentClickListener = (event: MouseEvent) => {
    const emojiPickerContainer = this.document.querySelector('.emoji-picker-container');
    const emojiButtonElement = (event.target as HTMLElement).closest('.btn-outline-secondary'); // Check if click was on the emoji button itself

    // Important: Use .contains(event.target as Node) for checking if click is *inside* a container
    // And ensure the clicked button is the emoji toggle button itself.
    if (
      emojiPickerContainer && !emojiPickerContainer.contains(event.target as Node) &&
      !(emojiButtonElement && emojiButtonElement.querySelector('.bi-emoji-smile')) // Checks if the clicked element is the emoji button or inside it
    ) {
      this.showEmojiPicker = false;
      // Remove the listener immediately when hiding the picker
      if (this.unsubscribeDocumentClickListener) {
        this.unsubscribeDocumentClickListener();
        this.unsubscribeDocumentClickListener = undefined;
      }
    }
  };

  ngOnInit(): void {

    const userId = this.userService.getUserIdFromToken();
    this.userService.getCurrentUserDetails().subscribe({
      next: (result: Result<UserDetails>) => {
        if (result.isSuccess && result.data) {
          // Assuming UserDetails contains all properties of User (including receiveNotifications)
          // and can be assigned to `currentUser` (e.g., UserDetails extends User or is structurally compatible).
          this.currentUser = result.data;
          console.log('Current user details loaded successfully:', this.currentUser);
        } else {
          console.error('Failed to load current user details:', result.errorMessage || 'Unknown error');
          // Optionally, handle specific error, e.g., show a snackbar notification
        }
      },
      error: (err) => {
        console.error('Error fetching current user details:', err);
        // Handle network or server errors
      }
    });
    this.addMemberSearchSubscription = this.addMemberSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.addMemberSearchPageNumber = 1;
      this.searchAddMembersResults = [];
      this.allAddMembersLoaded = false;
      this.performUserSearch(term, false, 'addMember'); 
    });

    this.chatUpdatedSubscription = this.signalRService.onChatUpdated().subscribe({
      next: (updatedChat: Chat) => {
        console.log('Received ChatUpdated event from SignalR:', updatedChat);
        this.handleChatUpdated(updatedChat); 
      },
      error: (err) => {
        console.error('Error receiving chat update via SignalR:', err);
      },
    });

  
    if (userId !== null) {
      this.currentUserId = userId;
      this.loadChats();
      this.signalRService.startConnection();
  
      // Subscribe to header visibility changes
      this.headerSubscription = this.headerService.isHeaderVisible$.subscribe(visible => {
        this.isVisible = visible;
      });
  
      // Mobile Responsiveness and Header Visibility Logic
      this.resizeSubscription = this.resizeSubjectDebouncer.pipe(
        debounceTime(100),
        distinctUntilChanged()
      ).subscribe(() => {
        const isLargeScreen = window.innerWidth >= 992;
  
        if (isLargeScreen) {
          this.isChatAreaVisibleOnMobile = true;
        } else {
          if (!this.activeChat) {
            this.isChatAreaVisibleOnMobile = false;
          }
        }
        this.updateHeaderVisibility();
        this.updateMobileHeaderClass();
      });
  
      // Trigger initial resize check
      this.onResize(null);
  
      // Router events subscription
      this.routerSubscription = this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        const chatId = +this.route.snapshot.paramMap.get('id')!;
        if (chatId && chatId !== this.activeChat?.id) {
          this.selectChat(chatId);
        } else if (!chatId) {
          this.backToChatList();
        }
      });
  
      // Initial load
      const initialChatId = +this.route.snapshot.paramMap.get('id')!;
      if (initialChatId) {
        this.selectChat(initialChatId);
      } else {
        const isSmallScreen = window.matchMedia("(max-width: 991.98px)").matches;
        if (isSmallScreen) {
          this.isChatAreaVisibleOnMobile = false;
        }
        this.updateHeaderVisibility();
        this.updateMobileHeaderClass();
      }
  
    } else {
      console.error('User ID not available from token. Cannot load chats.');
      this.snackBar.open('Error: Your session expired. Please log in again.', 'Close', { duration: 5000 });
      this.router.navigate(['/login']);
    }

    // --- SignalR Subscriptions (original individual management) ---
    this.chatMessageSubscription = this.signalRService.onReceiveMessage().subscribe({
      next: (message: Message | null) => {
        if (!message) return;

        if (this.activeChat && this.activeChat.id === message.chatId) {
          const existing = this.activeChat.messages.find(m => m.id === message.id);
          if (!existing) {
            this.activeChat.messages.push(message);
            this.activeChat.messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
            setTimeout(() => this.scrollToBottom(), 0);

            this.chatService.markMessagesAsRead({
              chatId: message.chatId,
              lastReadMessageId: message.id
            }).subscribe({
              next: res => {
                if (!res.isSuccess) {
                  console.warn('Failed to mark message as read:', res.errorMessage);
                }
              },
              error: err => console.error('Error marking message as read:', err)
            });
          }
        }

        const chatIndex = this.chats.findIndex(c => c.id === message.chatId);
        if (chatIndex !== -1) {
          const chatToUpdate = this.chats[chatIndex];
          if (!chatToUpdate.messages) {
            chatToUpdate.messages = [];
          }
          const exists = chatToUpdate.messages.find(m => m.id === message.id);
          if (!exists) {
            chatToUpdate.messages.push(message);
          }
          if (!chatToUpdate.lastMessage || new Date(message.sentAt) > new Date(chatToUpdate.lastMessage.sentAt)) {
            chatToUpdate.lastMessage = message;
          }
          if (!this.activeChat || this.activeChat.id !== message.chatId) {
            chatToUpdate.unreadCount = (chatToUpdate.unreadCount || 0) + 1;

            if (!chatToUpdate.isMutedForCurrentUser && this.currentUser?.receiveNotifications) {
              console.log(`Notification check: Chat Muted: ${chatToUpdate.isMutedForCurrentUser}, User Receive Notifications: ${this.currentUser?.receiveNotifications}`);
              this.playNotificationSound();
            } else {
              console.log(`Notification sound skipped. Chat muted: ${chatToUpdate.isMutedForCurrentUser}, User notifications enabled: ${this.currentUser?.receiveNotifications}`);
            }
          }
          this.chats.splice(chatIndex, 1);
          this.chats.unshift(chatToUpdate);
        } else {
          console.warn(`Received message for unknown chat ${message.chatId}. It might not be in the current user's chat list.`);
        }
      },
      error: err => console.error('Error receiving message via SignalR:', err)
    });

    this.userProfileUpdatedSubscription = this.signalRService.onUserProfileUpdated().subscribe((payload: UserProfileUpdatePayload) => {
      console.log(`ChatComponent: UserProfileUpdated event received via SignalR for User ID ${payload.userId}, ReceiveNotifications: ${payload.receiveNotifications}`);
      if (this.currentUser && this.currentUser.id === payload.userId) {
        console.log(`ChatComponent: Updating local currentUser.receiveNotifications from ${this.currentUser.receiveNotifications} to ${payload.receiveNotifications}`);
        this.currentUser.receiveNotifications = payload.receiveNotifications;
      }
  });

    this.chatMuteStatusSubscription = this.signalRService.onChatMuteStatusUpdated().subscribe({
      next: (update: MuteStatusUpdate | null) => {
        if (update) {
          console.log('Received ChatMuteStatusUpdated event from SignalR:', update);
          this.handleChatMuteStatusUpdate(update);
        }
      },
      error: (err) => {
        console.error('Error receiving chat mute status update via SignalR:', err);
      },
    });

    this.messageDeletedSubscription = this.signalRService.onMessageDeleted().subscribe(({ messageId, chatId }) => {
      if (this.activeChat && this.activeChat.id === chatId) {
        const messageIndex = this.activeChat.messages.findIndex(m => m.id === messageId);
        if (messageIndex > -1) {
          this.activeChat.messages[messageIndex].isDeleted = true;
          this.activeChat.messages[messageIndex].content = '[Message Deleted]';
          this.activeChat.messages[messageIndex].attachments = []; // Clear attachments for deleted messages
        }
      }
      const chatInList = this.chats.find(c => c.id === chatId);
      if (chatInList && chatInList.lastMessage?.id === messageId) {
          chatInList.lastMessage.content = '[Message Deleted]';
          chatInList.lastMessage.isDeleted = true;
          chatInList.lastMessage.attachments = [];
      }
    });


    this.messageEditedSubscription = this.signalRService.onMessageEdited().subscribe(updatedMessage => {
      console.log('Received MessageEdited event from SignalR:', updatedMessage);
      console.log("ffffffffffffffffffffffffffffffffffffffff");

      if (this.activeChat && this.activeChat.id === updatedMessage.chatId) {
        const messageIndex = this.activeChat.messages.findIndex(m => m.id === updatedMessage.id);
        if (messageIndex > -1) {
          this.activeChat.messages = this.activeChat.messages.map(msg =>
            msg.id === updatedMessage.id ? updatedMessage : msg
          );
          this.cdr.detectChanges();
          console.log('Active chat message list re-rendered due to edit:', updatedMessage.id);
        }
      }
      const chatIndexInList = this.chats.findIndex(c => c.id === updatedMessage.chatId);
      if (chatIndexInList !== -1) {
        const chatToUpdate = this.chats[chatIndexInList];

        if (chatToUpdate.lastMessage?.id === updatedMessage.id) {
          chatToUpdate.lastMessage = { ...updatedMessage };

          this.chats = this.chats.map(chat =>
            chat.id === chatToUpdate.id ? { ...chatToUpdate, lastMessage: chatToUpdate.lastMessage } : chat
          );

          console.log('Chat list last message updated:', updatedMessage.id);
          this.cdr.detectChanges();
        }
      }
    });

    this.chatCreatedSubscription = this.signalRService.onChatCreated().subscribe({
        next: (newChat: Chat | null) => {
          if (!newChat) return;
          console.log('Received ChatCreated event from SignalR:', newChat);

          if (!this.chats.some(c => c.id === newChat.id)) {
            this.chats.unshift(newChat);
            console.log('New chat successfully added to UI list via SignalR.');
          } else {
            console.log('Chat already exists in local list, skipping duplicate add via SignalR (or updating existing):', newChat.id);
            const existingChatIndex = this.chats.findIndex(c => c.id === newChat.id);
            if (existingChatIndex !== -1) {
              this.chats[existingChatIndex] = newChat;
            }
          }


          if (this.currentUserId && newChat.participants.some(p => p.userId === this.currentUserId && p.isAdmin)) {
            this.showCreateChatForm = false;
            this.selectChat(newChat.id);
          }

          this.loading = false;
        },
        error: err => {
          console.error('Error receiving new chat via SignalR:', err);
          this.loading = false;
        }
    });

    this.chatJoinedSubscription = this.signalRService.onChatJoined().subscribe({
      next: (newlyJoinedChat: Chat) => {
        console.log('Received ChatJoined event from SignalR:', newlyJoinedChat);
        this.handleChatJoined(newlyJoinedChat);
      },
      error: (err) => {
        console.error('Error receiving chat joined event via SignalR:', err);
      },
    });

    this.messageReactionAddedSubscription = this.signalRService.onMessageReactionAdded().subscribe(updatedMessage => {
      console.log('Handling MessageReactionAdded:', updatedMessage);
      this.updateMessageInUI(updatedMessage);
    });

    this.messageReactionRemovedSubscription = this.signalRService.onMessageReactionRemoved().subscribe(updatedMessage => {
      console.log('Handling MessageReactionRemoved:', updatedMessage);
      this.updateMessageInUI(updatedMessage);
    });
    
    if (userId !== null) {
      this.loadChats();
      this.signalRService.startConnection();
    } else {
      console.error('User ID not available from token. Cannot load chats.');
      this.snackBar.open('Error: Your session expired. Please log in again.', 'Close', { duration: 5000 });
      this.router.navigate(['/login']);
    }

    this.chatLeftSubscription = this.signalRService.onChatLeft().subscribe({
      next: (chatId: number) => {
        console.log('Received ChatLeft event from SignalR for chat ID:', chatId);
        this.handleChatLeft(chatId);
      },
      error: (err) => {
        console.error('Error receiving chat left event via SignalR:', err);
      },
    });

    this.chatStatusUpdatedSubscription = this.signalRService.onChatStatusUpdated().subscribe({
      next: (updatedChat: Chat) => {
        console.log('Received ChatStatusUpdated event from SignalR:', updatedChat);

        if (this.activeChat && this.activeChat.id === updatedChat.id) {
          this.activeChat.status = updatedChat.status;
          if (this.activeChat.status === ChatStatus.Rejected) {
            this.snackBar.open('This chat has been rejected.', 'Close', { duration: 3000 });
          }
        }

        const chatIndex = this.chats.findIndex(c => c.id === updatedChat.id);
        if (chatIndex !== -1) {
          this.chats[chatIndex] = updatedChat;
        }
      },
      error: (err) => {
        console.error('Error receiving chat status update via SignalR:', err);
      }
    });

      this.systemMessageSubscription = this.signalRService.onSystemMessageReceived().subscribe({
      next: (systemMessage: Message) => {
        console.log('Received System Message via SignalR:', systemMessage);

        if (this.activeChat && this.activeChat.id === systemMessage.chatId) {
          this.activeChat.messages.push(systemMessage);
          this.activeChat.messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
          setTimeout(() => this.scrollToBottom(), 0);
        }

        this.snackBar.open(systemMessage.content ?? 'System message received', 'Info', { duration: 5000 });

        const chatIndex = this.chats.findIndex(c => c.id === systemMessage.chatId);
        if (chatIndex !== -1) {
          const chatToUpdate = this.chats[chatIndex];
          if (!chatToUpdate.lastMessage || new Date(systemMessage.sentAt) > new Date(chatToUpdate.lastMessage.sentAt)) {
            chatToUpdate.lastMessage = systemMessage;
          }
          this.chats.splice(chatIndex, 1);
          this.chats.unshift(chatToUpdate);
        }
      },
      error: (err) => {
        console.error('Error receiving system message via SignalR:', err);
      }
    });

    this.userTypingStatusSubscription = this.signalRService
      .onUserTypingStatus()
      .subscribe({
        next: (status: UserTypingStatus) => {
          console.log('Received UserTypingStatus:', status);
          this.handleUserTypingStatus(status);
        },
        error: (err) => {
          console.error('Error receiving user typing status:', err);
        },
      });

    this.typingSubscription = this.typingActivitySubject
      .pipe(
        debounceTime(this.typingNotificationDelayMs) // Use debounce for "stopped typing"
      )
      .subscribe(() => {
        if (this.isTypingSent && this.activeChat?.id) {
          this.signalRService.sendStoppedTypingNotification(
            this.activeChat.id,
            this.currentUserId
          );
          this.isTypingSent = false;
          console.log('Sent UserStoppedTyping');
        }
      });
    // --- End New ---


    // Existing chat search subscription (original management)
    this.chatSearchSubscription = this.searchSubject.pipe(
      debounceTime(300)
    ).subscribe(searchTerm => {
      this.performSearch(searchTerm);
    });

    this.userSearchSubscription = this.userSearchSubject
    .pipe(debounceTime(300), distinctUntilChanged())
    .subscribe((searchTerm) => {
      this.userSearchPageNumber = 1;
      this.searchUsersResults = [];
      this.allUsersLoaded = false;
      this.performUserSearch(searchTerm, false, 'createChat');
    });
  }


  private handleChatMuteStatusUpdate(update: MuteStatusUpdate): void {
    if (this.activeChat && this.activeChat.id === update.chatId) {
      const participant = this.activeChat.participants.find(p => p.userId === update.userId);
      if (participant) {
        participant.isMuted = update.isMuted;
        console.log(`Active chat: Participant ${participant.userId} mute status updated to ${update.isMuted}`);
  
        if (update.userId === this.currentUserId) {
          this.activeChat.isMutedForCurrentUser = update.isMuted;
          console.log(`Active chat: Current user's mute status updated to ${update.isMuted}`);
        }
  
        this.cdr.detectChanges(); // Trigger change detection for active chat UI
      }
    }
    const chatInList = this.chats.find(c => c.id === update.chatId);
    if (chatInList) {
      const participantInList = chatInList.participants.find(p => p.userId === update.userId);
      if (participantInList) {
        participantInList.isMuted = update.isMuted;
        console.log(`Chat list: Participant ${participantInList.userId} mute status updated to ${update.isMuted}`);
  
        if (update.userId === this.currentUserId) {
          chatInList.isMutedForCurrentUser = update.isMuted;
          console.log(`Chat list: Chat ${chatInList.id} isMutedForCurrentUser updated to ${update.isMuted}`);
        }
        this.cdr.detectChanges(); // Trigger change detection for chat list UI
      }
    }
  }
  onMessageHover(messageId: number): void {
    this.hoveredMessageId = messageId;
  }

  onMessageLeave(): void {
    this.hoveredMessageId = null;
  }

  startEditMessage(message: Message): void {
    if (this.currentUserId === null || message.senderId !== this.currentUserId) {
      console.warn('Cannot edit: Not your message or user not logged in.');
      this.snackBar.open('You cannot edit this message.', 'Close', { duration: 3000 });
      return;
    }
    if (message.attachments && message.attachments.length > 0) {
      console.warn('Cannot edit: Messages with attachments cannot be edited.');
      this.snackBar.open('Messages with attachments cannot be edited.', 'Close', { duration: 3000 });
      return;
    }
    if (message.isSystemMessage) {
      console.warn('Cannot edit: System messages cannot be edited.');
      this.snackBar.open('System messages cannot be edited.', 'Close', { duration: 3000 });
      return;
    }

    this.editingMessageId = message.id;
    this.editedMessageContent = message.content || ''; // Populate with current content
    this.cdr.detectChanges(); // Ensure UI updates
  }

  cancelEditMessage(): void {
    this.editingMessageId = null;
    this.editedMessageContent = '';
    this.cdr.detectChanges(); // Ensure UI updates
  }

  saveEditedMessage(message: Message): void {
    if (this.currentUserId === null) {
      this.snackBar.open('Please log in to edit messages.', 'Close', { duration: 3000 });
      return;
    }

    const trimmedContent = this.editedMessageContent.trim();

    if (trimmedContent === (message.content?.trim() || '')) {
      this.snackBar.open('No changes detected.', 'Close', { duration: 3000 });
      this.cancelEditMessage();
      return;
    }

    if (trimmedContent === '') {
      // Optionally, prevent saving empty messages or prompt for deletion
      this.snackBar.open('Message cannot be empty.', 'Close', { duration: 3000 });
      return;
    }

    const editMessageDto: EditMessage = {
      messageId: message.id,
      chatId: message.chatId,
      userId: this.currentUserId,
      newContent: trimmedContent
    };

    this.chatService.editMessage(editMessageDto).subscribe({
      next: (response) => {
        if (response.isSuccess && response.data) {
          console.log('Message edited successfully:', response.data);
          this.snackBar.open('Message edited successfully!', 'Close', { duration: 2000 });
          // SignalR will handle updating the message in the UI via onMessageEdited
        } else {
          console.error('Failed to edit message:', response.errorMessage);
          this.snackBar.open(`Failed to edit message: ${response.errorMessage}`, 'Close', { duration: 3000 });
        }
        this.cancelEditMessage(); // Always close edit mode after attempt
      },
      error: (err) => {
        console.error('Error calling editMessage API:', err);
        this.snackBar.open('Error editing message. Please try again.', 'Close', { duration: 3000 });
        this.cancelEditMessage(); // Always close edit mode on error
      }
    });
  }

  onDeleteMessage(message: Message): void {
    if (!this.activeChat || this.currentUserId === null) {
      console.warn('Cannot delete: Chat or user not loaded.');
      this.snackBar.open('Chat or user not loaded. Cannot delete message.', 'Close', { duration: 3000 });
      return;
    }

    const canDelete =
      message.senderId === this.currentUserId ||
      this.isCurrentUserChatAdmin(this.activeChat);

    if (!canDelete) {
      console.warn('Cannot delete: You are not authorized to delete this message.');
      this.snackBar.open('You are not authorized to delete this message.', 'Close', { duration: 3000 });
      return;
    }

    // Using MatSnackBar for confirmation instead of `confirm()`
    const snackBarRef = this.snackBar.open('Are you sure you want to delete this message?', 'Delete', {
      duration: 5000,
      panelClass: ['snackbar-confirm'] // Add custom class for styling
    });

    // Removed takeUntil for onAction()
    snackBarRef.onAction().subscribe(() => {
      this.chatService.deleteMessage(message.id, message.chatId).subscribe({
        next: (response) => {
          if (response.isSuccess) {
            console.log('Message deleted successfully.');
            this.snackBar.open('Message deleted successfully!', 'Close', { duration: 2000 });
            // SignalR will handle updating the message in the UI via onMessageDeleted
          } else {
            console.error('Failed to delete message:', response.errorMessage);
            this.snackBar.open(`Failed to delete message: ${response.errorMessage}`, 'Close', { duration: 3000 });
          }
        },
        error: (err) => {
          console.error('Error calling deleteMessage API:', err);
          this.snackBar.open('Error deleting message. Please try again.', 'Close', { duration: 3000 });
        }
      });
    });
  }

  onEditMessage(message: Message): void {
    // Add null check for currentUserId
    if (this.currentUserId === null || message.senderId !== this.currentUserId) { 
      console.warn('Cannot edit: Not your message or user not logged in.');
      return;
    }
    if (message.attachments && message.attachments.length > 0) {
      console.warn('Cannot edit: Messages with attachments cannot be edited.');
      return;
    }
    if (message.isSystemMessage) {
        console.warn('Cannot edit: System messages cannot be edited.');
        return;
    }

  const newContent = prompt('Edit your message:', message.content || '');

  if (newContent !== null && newContent.trim() !== (message.content?.trim() || '')) {
    const editMessageDto: EditMessage = {
      messageId: message.id,
      chatId: message.chatId,
      userId: this.currentUserId, // Good, userId is sent
      newContent: newContent.trim()
    };

    this.chatService.editMessage(editMessageDto).subscribe({
      next: (response) => {
        if (response.isSuccess && response.data) {
          console.log('Message edited successfully:', response.data);
        } else {
          console.error('Failed to edit message:', response.errorMessage);
        }
      },
      error: (err) => {
        console.error('Error calling editMessage API:', err);
      }
    });
  }
  }

  addReaction(message: Message, emoji: string): void {
    if (this.currentUserId === null) {
      this.snackBar.open('Please log in to react.', 'Close', { duration: 3000 });
      return;
    }

    const hasReactedWithThisEmoji = message.reactions?.some(
      r => r.userId === this.currentUserId && r.reaction === emoji
    );

    if (hasReactedWithThisEmoji) {
      this.removeReaction(message, emoji);
    } else {
      const addReactionDto: AddReaction = {
        messageId: message.id,
        chatId: message.chatId,
        userId: this.currentUserId,
        reaction: emoji
      };

      this.chatService.addReaction(addReactionDto).subscribe({
        next: (response) => {
          if (response.isSuccess && response.data) {
            console.log('Reaction added successfully (API response):', response.data);
            // SignalR will handle updating the message in the UI via onMessageReactionAdded
          } else {
            console.error('Failed to add reaction:', response.errorMessage);
            this.snackBar.open(`Failed to add reaction: ${response.errorMessage}`, 'Close', { duration: 3000 });
          }
        },
        error: (err) => {
          console.error('Error calling addReaction API:', err);
          this.snackBar.open('Error adding reaction. Please try again.', 'Close', { duration: 3000 });
        }
      });
    }
    this.showEmojiPickerForMessageId = null; // Close picker after action
  }

  toggleEmojiPickerForMessage(messageId: number): void {
    this.showEmojiPickerForMessageId = this.showEmojiPickerForMessageId === messageId ? null : messageId;
    this.cdr.detectChanges(); 
  }

  private updateMessageInUI(updatedMessage: Message): void {
    if (this.activeChat && this.activeChat.id === updatedMessage.chatId) {
      const messageIndex = this.activeChat.messages.findIndex(m => m.id === updatedMessage.id);
      if (messageIndex > -1) {
        // Ensure immutability for Angular's change detection if needed,
        // though direct assignment often works with simple arrays
        this.activeChat.messages = this.activeChat.messages.map(msg =>
          msg.id === updatedMessage.id ? updatedMessage : msg
        );
        this.cdr.detectChanges();
        console.log('Active chat message updated (reactions/edit):', updatedMessage.id);
      }
    }

    const chatInListIndex = this.chats.findIndex(c => c.id === updatedMessage.chatId);
    if (chatInListIndex !== -1) {
      const chatToUpdate = this.chats[chatInListIndex];
      if (chatToUpdate.lastMessage?.id === updatedMessage.id) {
        chatToUpdate.lastMessage = { ...updatedMessage }; // Deep copy
        this.cdr.detectChanges();
        console.log('Chat list last message updated (reactions/edit):', updatedMessage.id);
      }
    }
  }

  removeReaction(message: Message, reaction: string): void {
    if (this.currentUserId === null) {
      this.snackBar.open('Please log in to remove reactions.', 'Close', { duration: 3000 });
      return;
    }

    const removeReactionDto: RemoveReaction = {
      messageId: message.id,
      chatId: message.chatId,
      userId: this.currentUserId,
      reaction: reaction
    };

    this.chatService.removeReaction(removeReactionDto).subscribe({
      next: (response) => {
        if (response.isSuccess && response.data) {
          console.log('Reaction removed successfully (API response):', response.data);
          // SignalR will handle updating the message in the UI via onMessageReactionRemoved
        } else {
          console.error('Failed to remove reaction:', response.errorMessage);
          this.snackBar.open(`Failed to remove reaction: ${response.errorMessage}`, 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error('Error calling removeReaction API:', err);
        this.snackBar.open('Error removing reaction. Please try again.', 'Close', { duration: 3000 });
      }
    });
    this.showEmojiPickerForMessageId = null;
  }

  getGroupedReactions(message: Message): { emoji: string, count: number, reactedByCurrentUser: boolean, users: { username: string, avatarUrl?: string }[] }[] {
    if (!message.reactions || message.reactions.length === 0) {
      return [];
    }

    const grouped = new Map<string, { count: number, reactedByCurrentUser: boolean, users: { username: string, avatarUrl?: string }[] }>();

    for (const reaction of message.reactions) {
      if (!grouped.has(reaction.reaction)) {
        grouped.set(reaction.reaction, { count: 0, reactedByCurrentUser: false, users: [] });
      }
      const entry = grouped.get(reaction.reaction)!;
      entry.count++;
      if (this.currentUserId !== null && reaction.userId === this.currentUserId) {
        entry.reactedByCurrentUser = true;
      }
      entry.users.push({ username: reaction.username, avatarUrl: reaction.avatarUrl });
    }

    return Array.from(grouped.entries()).map(([emoji, data]) => ({
      emoji: emoji,
      count: data.count,
      reactedByCurrentUser: data.reactedByCurrentUser,
      users: data.users
    }));
  }

  getReactionTooltip(users: { username: string }[]): string {
    if (!users || users.length === 0) return '';
    return users.map(u => u.username).join(', ');
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions to prevent memory leaks
    this.chatMessageSubscription?.unsubscribe();
    this.chatCreatedSubscription?.unsubscribe();
    this.chatStatusUpdatedSubscription?.unsubscribe();
    this.systemMessageSubscription?.unsubscribe();
    this.chatUpdatedSubscription?.unsubscribe(); // New subscription to unsubscribe
    this.chatSearchSubscription?.unsubscribe();
    this.userSearchSubscription?.unsubscribe();
    this.addMemberSearchSubscription?.unsubscribe(); 
    this.chatJoinedSubscription?.unsubscribe();
    if (this.unsubscribeDocumentClickListener) {
      this.unsubscribeDocumentClickListener();
    }
    this.routerSubscription?.unsubscribe();
    this.resizeSubscription?.unsubscribe();
    this.headerSubscription?.unsubscribe();
    this.userTypingStatusSubscription?.unsubscribe();
    this.typingSubscription?.unsubscribe();
    this.chatLeftSubscription?.unsubscribe();
    this.messageReactionAddedSubscription?.unsubscribe(); // NEW
    this.messageReactionRemovedSubscription?.unsubscribe();
    this.userProfileUpdatedSubscription?.unsubscribe();
    this.initialUserLoadSubscription?.unsubscribe();

    this.signalRService.stopConnection(); // Stop SignalR connection
    this.attachments.forEach((att) => {
      if (att.fileUrl) URL.revokeObjectURL(att.fileUrl);
    });
  }

  handleChatJoined(newlyJoinedChat: Chat): void {
    console.log('Processing newly joined chat:', newlyJoinedChat);

    const chatIndex = this.chats.findIndex((c) => c.id === newlyJoinedChat.id);

    if (chatIndex === -1) {
      this.chats.unshift(newlyJoinedChat);
      this.sortChatsByLastMessage();
      console.log('Successfully added newly joined chat to UI list:', newlyJoinedChat.id);
    } else {
      console.warn('Chat already exists in local list, updating it with ChatJoined data:', newlyJoinedChat.id);
      Object.assign(this.chats[chatIndex], newlyJoinedChat);
      this.sortChatsByLastMessage(); // Re-sort in case last message changed
    }
  }

  handleChatLeft(chatId: number): void {
    console.log('Processing chat left event for chat ID:', chatId);

    // If the currently active chat is the one that was left, de-select it
    if (this.activeChat && this.activeChat.id === chatId) {
      this.activeChat = null; // Clear active chat
      this.router.navigate(['/chat']); // Navigate back to the chat list or a default view
      this.snackBar.open('You have been removed from this chat.', 'Dismiss', { duration: 5000 });
    }

    // Remove the chat from the local 'chats' array
    const initialLength = this.chats.length;
    this.chats = this.chats.filter(c => c.id !== chatId);
    if (this.chats.length < initialLength) {
      console.log(`Chat ${chatId} successfully removed from UI list.`);
    } else {
      console.warn(`Attempted to remove chat ${chatId} but it was not found in the list.`);
    }

    // if (this.cdr) { // Uncomment if using ChangeDetectionStrategy.OnPush
    //   this.cdr.detectChanges();
    // }
  }
  
  handleUserTypingStatus(status: UserTypingStatus): void {
    if (status.userId === this.currentUserId) {
      return; // Ignore typing status from the current user
    }

    if (!this.activeChat || this.activeChat.id !== status.chatId) {
      if (!this.typingUsers[status.chatId]) {
        this.typingUsers[status.chatId] = [];
      }
      const existingIndexNonActive = this.typingUsers[status.chatId].findIndex(
        (u) => u.userId === status.userId
      );
      if (status.isTyping) {
        if (existingIndexNonActive === -1) {
          this.typingUsers[status.chatId].push(status);
        } else {
          this.typingUsers[status.chatId][existingIndexNonActive] = status;
        }
      } else {
        if (existingIndexNonActive !== -1) {
          this.typingUsers[status.chatId].splice(existingIndexNonActive, 1);
        }
      }
      return;
    }

    if (!this.typingUsers[status.chatId]) {
      this.typingUsers[status.chatId] = [];
    }

    const existingIndex = this.typingUsers[status.chatId].findIndex(
      (u) => u.userId === status.userId
    );

    let shouldScroll = false;

    if (status.isTyping) {
      if (existingIndex === -1) {
        this.typingUsers[status.chatId].push(status);
        shouldScroll = true; 
      } else {
        this.typingUsers[status.chatId][existingIndex] = status;
      }
    } else {
      if (existingIndex !== -1) {
        this.typingUsers[status.chatId].splice(existingIndex, 1);
        shouldScroll = true;
      }
    }

    // --- Add this block ---
    // Trigger scroll if the typing status changes for the active chat
    if (shouldScroll) {
      // Use setTimeout to ensure the DOM has updated with the new typing indicator state
      setTimeout(() => {
        this.scrollToBottom();
      }, 50); // A small delay is usually sufficient
    }
    // --- End of added block ---
  }

  getTypingMessage(): string {
    const typingUsers = this.getTypingUsersForActiveChat();
    if (typingUsers.length === 0) {
      return '';
    } else if (typingUsers.length === 1) {
      return `${typingUsers[0].username} is typing`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].username} and ${typingUsers[1].username} are typing`;
    } else {
      // For 3 or more users, list the first two and indicate "others"
      const otherCount = typingUsers.length - 2;
      return `${typingUsers[0].username}, ${typingUsers[1].username}${
        otherCount > 0 ? ` and ${otherCount} other${otherCount > 1 ? 's' : ''}` : ''
      } are typing`;
    }
  }

  getTypingUsersForActiveChat(): UserTypingStatus[] {
    if (!this.activeChat?.id) {
      return [];
    }
    // Filter out the current user from the typing list
    return (this.typingUsers[this.activeChat.id] || []).filter(
      (user) => user.userId !== this.currentUserId
    );
  }

  onMessageInput(): void {
    if (!this.activeChat?.id || !this.currentUserId) {
      return;
    }

    if (!this.isTypingSent) {
      // Immediately send "user typing" the first time
      this.signalRService.sendTypingNotification(
        this.activeChat.id,
        this.currentUserId
      );
      this.isTypingSent = true;
      console.log('Sent UserTyping (first time)');
    }

    // Reset the debounce timer for "stopped typing"
    this.typingActivitySubject.next();
  }


  ngAfterViewChecked(): void {
    if (this.scrollContainer && !this.initialMessageLoadDone && this.activeChat && this.activeChat.messages && this.activeChat.messages.length > 0) {
      this.scrollToBottom();
      this.initialMessageLoadDone = true;
    }

    if (!this.loadingMessages && this.previousScrollHeight > 0) {
      const container = this.scrollContainer.nativeElement;
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - this.previousScrollHeight;
      this.previousScrollHeight = 0;
    }
  }

  acceptChat(chatId: number): void {
    if (!this.currentUserId) {
      this.snackBar.open('Error: User not logged in.', 'Close', { duration: 3000 });
      return;
    }

    const updateDto: UpdateChatStatus = {
      chatId: chatId,
      newStatus: ChatStatus.Active,
      userId: this.currentUserId
    };

    this.chatService.updateChatStatus(updateDto).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data) { // Assuming backend sends `Result<bool>` with `value` property
          // **DO NOT MANUALLY UPDATE `this.activeChat.status` HERE**
          // The SignalR event `ChatStatusUpdated` will handle this in `onChatStatusUpdated` subscription.
          this.snackBar.open('Chat accepted successfully!', 'Close', { duration: 3000 });
        } else {
          this.snackBar.open(result?.errorMessage || 'Failed to accept chat.', 'Close', { duration: 5000 });
        }
      },
      error: (err) => {
        console.error('Error accepting chat:', err);
        const errorMessage = err.error?.errorMessage || err.error?.title || 'An error occurred while accepting chat.';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      }
    });
  }

  rejectChat(chatId: number): void {
    if (!this.currentUserId) {
      this.snackBar.open('Error: User not logged in.', 'Close', { duration: 3000 });
      return;
    }

    const updateDto: UpdateChatStatus = {
      chatId: chatId,
      newStatus: ChatStatus.Rejected,
      userId: this.currentUserId
    };

    this.chatService.updateChatStatus(updateDto).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data) { 
          this.snackBar.open('Chat rejected.', 'Close', { duration: 3000 });
          this.router.navigate(['/chat']); 
        } else {
          this.snackBar.open(result?.errorMessage || 'Failed to reject chat.', 'Close', { duration: 5000 });
        }
      },
      error: (err) => {
        console.error('Error rejecting chat:', err);
        const errorMessage = err.error?.errorMessage || err.error?.title || 'An error occurred while rejecting chat.';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
      }
    });
  }

  onMainChatListScroll(event: Event): void {
    const element = event.target as HTMLElement;
    // Check if scrolled to the bottom (within a small threshold, e.g., 1 pixel)
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 1) {
      if (this.isSearching && this.searchTerm.trim() !== '' && !this.loading && !this.allChatSearchResultsLoaded) {
        console.log('Scrolled near bottom of chat search results, loading more...');
        this.performSearch(this.searchTerm, true); // Load more search results
      } else if (!this.isSearching && !this.loading && !this.allLoaded) {
        console.log('Scrolled near bottom of chat list, loading more chats...');
        this.loadChats(); // Load more regular chats
      }
    }
  }

  onChatSearchTermChange(): void {
    this.isSearching = this.searchTerm.trim().length > 0;
    // Reset search pagination when a new search term is entered
    if (this.searchTerm.trim().length === 0) {
      this.searchResults = [];
      this.chatSearchPageNumber = 1;
      this.allChatSearchResultsLoaded = false;
      this.searchSubject.next(''); // Clear any pending search
    } else {
      this.chatSearchPageNumber = 1; // Reset page for a new search
      this.allChatSearchResultsLoaded = false; // Reset loaded flag for a new search
      this.searchSubject.next(this.searchTerm);
    }
  }

  performSearch(term: string, loadMore: boolean = false): void {
    if (this.loading && loadMore) return; // Prevent multiple requests for infinite scroll
    if (this.allChatSearchResultsLoaded && loadMore) return; // Stop if all chat search results are loaded

    if (term.trim() === '') {
      this.isSearching = false;
      this.searchResults = [];
      this.chatSearchPageNumber = 1;
      this.allChatSearchResultsLoaded = false;
      return;
    }

    this.isSearching = true;
    this.loading = true;

    // Determine the page number for the request
    const page = loadMore ? this.chatSearchPageNumber : 1;

    console.log(`Performing chat search for "${term}", page: ${page}, pageSize: ${this.pageSize}`);

    this.chatService.searchChats(term, page, this.pageSize).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data) {
          if (loadMore) {
            this.searchResults = [...this.searchResults, ...result.data];
          } else {
            this.searchResults = result.data; // New search, replace results
          }

          if (result.data.length < this.pageSize) {
            this.allChatSearchResultsLoaded = true;
          } else {
            this.chatSearchPageNumber++; // Increment page only if more results are possible
          }
        } else {
          console.error('Failed to search chats:', result.errorMessage);
          if (!loadMore) this.searchResults = [];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error during chat search:', err);
        if (!loadMore) this.searchResults = [];
        this.loading = false;
      }
    });
  }

  filteredChats(): Chat[] {
    // If we are searching and there's a search term, return search results
    if (this.isSearching && this.searchTerm.trim() !== '') {
      return this.searchResults;
    }
    // Otherwise, return the regular chats
    return this.chats;
  }

  onUserSearchTermChange(): void {
    this.userSearchSubject.next(this.searchUsersTerm);
  }

  performUserSearch(
    term: string,
    loadMore: boolean = false,
    context: 'createChat' | 'addMember'
  ): void {
    // Determine which state variables to use based on context
    let isSearchingRef: boolean;
    let searchResultsRef: User[];
    let allLoadedRef: boolean;
    let pageNumberRef: number;
    let pageSizeRef: number;

    if (context === 'createChat') {
      isSearchingRef = this.isSearchingUsers;
      searchResultsRef = this.searchUsersResults;
      allLoadedRef = this.allUsersLoaded;
      pageNumberRef = this.userSearchPageNumber;
      pageSizeRef = this.userSearchPageSize;
    } else {
      // context === 'addMember'
      isSearchingRef = this.isSearchingAddMembers;
      searchResultsRef = this.searchAddMembersResults;
      allLoadedRef = this.allAddMembersLoaded;
      pageNumberRef = this.addMemberSearchPageNumber;
      pageSizeRef = this.addMemberSearchPageSize;
    }

    if (isSearchingRef && loadMore) return;
    if (term.trim() === '' && !loadMore) {
      if (context === 'createChat') {
        this.searchUsersResults = [];
        this.isSearchingUsers = false;
        this.allUsersLoaded = false;
        this.userSearchPageNumber = 1;
      } else {
        this.searchAddMembersResults = [];
        this.isSearchingAddMembers = false;
        this.allAddMembersLoaded = false;
        this.addMemberSearchPageNumber = 1;
      }
      return;
    }
    if (allLoadedRef && loadMore) return;

    if (context === 'createChat') this.isSearchingUsers = true;
    else this.isSearchingAddMembers = true;

    const page = loadMore ? pageNumberRef : 1;

    this.userService.searchUsers(term, page, pageSizeRef).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data) {
          let filteredResults = result.data;

          // Apply context-specific filtering
          if (context === 'createChat') {
            filteredResults = filteredResults.filter(
              (user) =>
                !this.selectedParticipants.some((p) => p.id === user.id) &&
                user.id !== this.currentUserId
            );
          } else {
            // context === 'addMember'
            // Filter out users already in the active chat's participants
            filteredResults = filteredResults.filter(
              (user) =>
                this.activeChat &&
                !this.activeChat.participants.some((p) => p.userId === user.id) &&
                user.id !== this.currentUserId
            );
          }

          if (loadMore) {
            if (context === 'createChat') {
              this.searchUsersResults = [...this.searchUsersResults, ...filteredResults];
            } else {
              this.searchAddMembersResults = [...this.searchAddMembersResults, ...filteredResults];
            }
          } else {
            if (context === 'createChat') {
              this.searchUsersResults = filteredResults;
            } else {
              this.searchAddMembersResults = filteredResults;
            }
          }

          if (result.data.length < pageSizeRef) {
            if (context === 'createChat') this.allUsersLoaded = true;
            else this.allAddMembersLoaded = true;
          } else {
            if (context === 'createChat') this.userSearchPageNumber++;
            else this.addMemberSearchPageNumber++;
          }
        } else {
          console.error('Failed to search users:', result.errorMessage);
          if (!loadMore) {
            if (context === 'createChat') this.searchUsersResults = [];
            else this.searchAddMembersResults = [];
          }
        }

        if (context === 'createChat') this.isSearchingUsers = false;
        else this.isSearchingAddMembers = false;
      },
      error: (err) => {
        console.error('Error during user search:', err);
        if (!loadMore) {
          if (context === 'createChat') this.searchUsersResults = [];
          else this.searchAddMembersResults = [];
        }
        if (context === 'createChat') this.isSearchingUsers = false;
        else this.isSearchingAddMembers = false;
      },
    });
  }

  onUserSearchScroll(event: Event): void {
    const element = event.target as HTMLElement;
    // Check if scrolled to the bottom (within a small threshold)
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 1 && !this.isSearchingUsers && !this.allUsersLoaded) {
      // CORRECTED: Pass 'createChat' as the third argument for the context
      this.performUserSearch(this.searchUsersTerm, true, 'createChat'); // Load more users for create chat
    }
  }

  selectUserForChat(user: User): void {
    // Add user if not already selected
    if (!this.selectedParticipants.some(p => p.id === user.id)) {
      this.selectedParticipants.push(user);
      // Remove from search results to avoid re-selection
      this.searchUsersResults = this.searchUsersResults.filter(u => u.id !== user.id);
    }
  }

  removeSelectedUser(user: User): void {
    this.selectedParticipants = this.selectedParticipants.filter(p => p.id !== user.id);
    // If the user was part of the current search results, add them back (optional, but good UX)
    if (this.searchUsersTerm.trim() !== '' && user.username.toLowerCase().includes(this.searchUsersTerm.toLowerCase())) {
        if (!this.searchUsersResults.some(u => u.id === user.id)) {
            this.searchUsersResults.push(user);
            // Re-sort to maintain order, or simply add as is
            this.searchUsersResults.sort((a,b) => a.username.localeCompare(b.username));
        }
    }
  }

  getUserAvatar(user: User): string {
      return user.avatarUrl ? `${this.imageBaseUrl}${user.avatarUrl}` : `${this.imageBaseUrl}/images/default/userImage.png`;
  }

  onNewChat(): void {
    this.showCreateChatForm = true;
    this.errorMessage = null;
    this.newChat = { // Reset newChat properties
      name: '',
      isGroup: false,
    };
    this.selectedParticipants = []; // Clear selected participants
    this.searchUsersTerm = ''; // Clear user search term
    this.searchUsersResults = []; // Clear user search results
    this.userSearchPageNumber = 1; // Reset user search page
    this.allUsersLoaded = false; // Reset user loaded flag
    this.selectedFile = null;
    if (this.createChatFormRef) {
      this.createChatFormRef.resetForm();
    }
  }

  onCloseModal(): void {
    this.showCreateChatForm = false;
    this.errorMessage = null;
    if (this.createChatFormRef) {
      this.createChatFormRef.resetForm();
    }
    this.newChat = { name: '', isGroup: false };
    this.selectedParticipants = []; // Reset
    this.searchUsersTerm = ''; // Reset
    this.searchUsersResults = []; // Reset
    this.userSearchPageNumber = 1; // Reset
    this.allUsersLoaded = false; // Reset
    this.selectedFile = null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.selectedFile = input.files[0];
    }
  }

  onCreateChatSubmit(form: NgForm): void {
    if (this.loading) {
      return; // Prevent multiple submissions
    }

    this.loading = true; // Start loading indicator
    this.errorMessage = null; // Clear previous errors

    const userId = this.userService.getUserIdFromToken();
    if (!userId) {
      this.errorMessage = 'User ID is not available. Please log in again.';
      this.loading = false;
      return;
    }

    const participantIds = this.selectedParticipants.map(p => p.id);

    // Ensure the creator is always a participant and not duplicated
    if (!participantIds.includes(userId)) {
      participantIds.push(userId);
    }

    // Validation: Require at least one other participant for chat creation
    if (participantIds.length <= 1) { // Only the current user selected
      this.errorMessage = 'Please select at least one other participant to create a chat.';
      this.loading = false;
      return;
    }

    // Safely get and trim the chat name
    const trimmedChatName = this.newChat.name ? this.newChat.name.trim() : '';

    // Determine if it's a group chat:
    // It's a group if a name is provided OR if there are more than 2 participants (creator + at least two others).
    // Note: The `isGroup` flag *must* be set before the name validation below.
    const isGroupChat = trimmedChatName !== '' || participantIds.length > 2;

    // --- Name Requirement Validation ---
    // If it's identified as a group chat, a non-empty name is strictly required.
    if (isGroupChat && trimmedChatName === '') {
      this.errorMessage = 'A chat name is required for group chats.';
      this.loading = false;
      return; // Stop the function here if the name is missing for a group chat
    }

    // Prepare the 'name' for the DTO based on whether it's empty.

    const chatNameForDto: string | null = trimmedChatName === '' ? null : trimmedChatName;

    const dto: CreateChat = {
      name: chatNameForDto, // This is now correctly `string | null`
      isGroup: isGroupChat, // Use the determined `isGroupChat` flag
      participantIds: participantIds,
      createdByUserId: userId,
      avatarUrl: this.selectedFile // This is the File object for upload
    };

    console.log('Submitting chat creation via HTTP:', dto);

    this.chatService.createChat(dto).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          console.log('HTTP Chat creation request successful. Waiting for SignalR broadcast...');
        } else {
          this.errorMessage = result.errorMessage || 'Failed to create chat.';
          console.error('HTTP Chat creation failed:', result.errorMessage);
        }
        this.loading = false; // Always stop loading on success or explicit error
      },
      error: (err) => {
        this.loading = false; // Always stop loading on HTTP error
        this.errorMessage = 'An error occurred while creating the chat. Please try again.';
        console.error('HTTP Chat creation error:', err);
      }
    });
  }

  handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const fileReads: Promise<FileAttachmentCreate>[] = [];

      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];

        const fileReadPromise = new Promise<FileAttachmentCreate>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = (e: any) => {
            const base64String = e.target.result as string;
            const attachment: FileAttachmentCreate = {
              fileData: base64String,
              fileUrl: URL.createObjectURL(file),
              fileType: file.type,
              fileName: file.name
            };
            resolve(attachment);
          };

          reader.onerror = (error) => {
            console.error('Error reading file:', error);
            reject(error);
          };

          reader.readAsDataURL(file);
        });

        fileReads.push(fileReadPromise);
      }

      Promise.all(fileReads).then(newAttachments => {
        this.attachments = [...this.attachments, ...newAttachments];
        this.sendMessageDto.attachments = [...this.attachments];
        console.log('Attachments added:', newAttachments);
        console.log('Current attachments:', this.attachments);
      }).catch(error => {
        console.error('One or more files failed to read:', error);
      });
    }
  }


  handleSendMessage(): void {
    if (!this.activeChat?.id) {
      console.error('No active chat selected. Cannot send message.');
      return;
    }
    // Only apply status check for non-group chats if that's your rule
    if (!this.activeChat.isGroup) {
      if (this.activeChat.status !== ChatStatus.Active) {
        this.snackBar.open('Cannot send message: Chat is not active.', 'Close', { duration: 3000 });
        return;
      }
    }

    this.sendMessageDto.chatId = this.activeChat.id;
    this.sendMessageDto.senderId = this.currentUserId; // Ensure senderId is set

    // Trim content for validation, but preserve spaces within content for sending
    const trimmedContent = this.sendMessageDto.content?.trim();

    if (!trimmedContent && this.attachments.length === 0) {
      console.warn('Cannot send an empty message or a message without content or attachments.');
      return;
    }

    // Attachments should be assigned before sending the DTO
    this.sendMessageDto.attachments = [...this.attachments];

    console.log('Attempting to send DTO:', this.sendMessageDto);

    this.signalRService.sendMessage(this.sendMessageDto);

    // --- Post-send actions ---
    this.sendMessageDto.content = ''; // Clear message input
    
    this.attachments.forEach(att => {
      if (att.fileUrl) URL.revokeObjectURL(att.fileUrl); // Clean up attachment URLs
    });
    this.attachments = []; // Clear attachments array
    this.sendMessageDto.attachments = []; // Clear attachments from DTO

    if (this.fileInputRef && this.fileInputRef.nativeElement) {
      this.fileInputRef.nativeElement.value = ''; // Clear file input field
    }
    
    this.showEmojiPicker = false; // <-- Crucial: Close emoji picker after sending
    
    console.log('Message sent. Input fields and attachments cleared. Emoji picker closed.');
  }
  selectChat(chatId: number): void {
    console.log(this.isVisible);

    if (this.activeChat?.id === chatId) {
      setTimeout(() => this.scrollToBottom(), 50);
      this.isChatAreaVisibleOnMobile = true;
      this.updateHeaderVisibility();
      this.updateMobileHeaderClass();
      return;
    }
    
    this.sendMessageDto.content = '';
    this.attachments.forEach(att => {
      if (att.fileUrl) URL.revokeObjectURL(att.fileUrl);
    });
    this.attachments = [];
    this.sendMessageDto.attachments = []; 
    if (this.fileInputRef && this.fileInputRef.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
    const selectedChat = this.chats.find(c => c.id === chatId);
  
    if (selectedChat) {
      this.activeChat = null;
      this.loadingMessages = false;
      this.allMessagesLoaded = false;
      this.initialMessageLoadDone = false;
      this.sendMessageDto.chatId = chatId;
      this.isLoadingChat = true;
  
      this.isChatAreaVisibleOnMobile = true;
      this.updateHeaderVisibility();
  
      this.chatService.getChatById(chatId, this.currentUserId)
        .subscribe({
          next: (result: Result<Chat>) => {
            if (result.isSuccess && result.data) {
              this.activeChat = result.data;
              this.activeChat.messages = this.activeChat.messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
              console.log(this.activeChat);
              const chatInList = this.chats.find(c => c.id === chatId);
              if (chatInList) chatInList.unreadCount = 0;
              const chatInSearchResults = this.searchResults.find(c => c.id === chatId);
              if (chatInSearchResults) chatInSearchResults.unreadCount = 0;
  
              if (this.activeChat.messages.length < 50) {
                this.allMessagesLoaded = true;
              }
              setTimeout(() => this.scrollToBottom(), 50);
            } else {
              console.error('Failed to load chat details:', result.errorMessage);
              this.handleChatLoadError();
            }
            this.isLoadingChat = false;
            this.updateHeaderVisibility();
            this.updateMobileHeaderClass();
          },
          error: (err) => {
            console.error('Error loading chat details:', err);
            this.handleChatLoadError();
            this.isLoadingChat = false;
          }
        });
    } else {
      this.handleChatLoadError();
    }
    console.log(this.isVisible);
    
  }

  loadMoreMessages(): void {
    if (!this.activeChat || this.loadingMessages || this.allMessagesLoaded) {
      return;
    }

    this.loadingMessages = true;
    const oldestMessageId = this.activeChat.messages.length > 0
      ? this.activeChat.messages[0].id
      : null;

    const container = this.scrollContainer.nativeElement;
    this.previousScrollHeight = container.scrollHeight; // Save current scroll height

    console.log(`Requesting more messages for chat ${this.activeChat.id}, older than message ID: ${oldestMessageId}`);

    this.chatService.getChatMessages(this.activeChat.id, oldestMessageId, 50)
      .subscribe({
        next: (result: Result<Message[]>) => {
          if (result.isSuccess && result.data && this.activeChat) {
            if (result.data.length === 0) {
              this.allMessagesLoaded = true;
              console.log('All historical messages loaded for chat:', this.activeChat.id);
            } else {
              // Prepend new messages to the existing list
              this.activeChat.messages = [...result.data, ...this.activeChat.messages];
              console.log('Loaded new messages:', result.data);
            }
            this.loadingMessages = false;
          } else {
            console.error('Failed to load more messages:', result.errorMessage);
            this.loadingMessages = false;
          }
        },
        error: (err) => {
          console.error('Error loading more messages:', err);
          this.loadingMessages = false;
        }
      });
  }

  loadChats(): void {
    if (this.isSearching || this.loading || this.allLoaded) return;

    const userId = this.userService.getUserIdFromToken();
    if (!userId) {
      console.error('User ID is not available.');
      return;
    }

    this.loading = true;
    console.log(`Loading chats for page: ${this.currentPage}, pageSize: ${this.pageSize}`);
    this.chatService.getUserChats(userId, this.currentPage, this.pageSize).subscribe({
      next: (result) => {
        const newChats = result.data ?? [];
        console.log('Loaded chats from API:', newChats);

        if (newChats.length < this.pageSize) {
          this.allLoaded = true; // No more chats to load
        }

        // Sort new chats by last message/creation time
        newChats.sort((a, b) => {
          const latestMsgA = a.messages.length > 0 ? a.messages[a.messages.length - 1].sentAt : a.createdAt;
          const latestMsgB = b.messages.length > 0 ? b.messages[b.messages.length - 1].sentAt : b.createdAt;
          return new Date(latestMsgB).getTime() - new Date(latestMsgA).getTime();
        });

        // Add new chats to the existing list, avoiding duplicates and updating existing
        newChats.forEach(newChat => {
            const existingChatIndex = this.chats.findIndex(existingChat => existingChat.id === newChat.id);
            if (existingChatIndex === -1) {
                this.chats.push(newChat); // Add new chat
            } else {
                // Update existing chat with new data (e.g., if last message changed)
                Object.assign(this.chats[existingChatIndex], newChat);
            }
        });

        // Re-sort the entire chats array after adding/updating
        this.chats.sort((a, b) => {
            const latestMsgA = a.lastMessage ? a.lastMessage.sentAt : a.createdAt;
            const latestMsgB = b.lastMessage ? b.lastMessage.sentAt : b.createdAt;
            return new Date(latestMsgB).getTime() - new Date(latestMsgA).getTime();
        });

        this.currentPage++;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading chats', err);
        this.loading = false;
      }
    });
  }

  getPrivateChatName(chat: Chat): string {
    if (chat.isGroup) {
      return chat.name;
    }
    const otherParticipant = chat.participants.find(p => p.userId !== this.currentUserId);
    return otherParticipant?.username || 'Unknown User';
  }

  getChatAvatar(item: Chat | User): string {
    // Check if it's a Chat or a User
    if ('avatarUrl' in item && item.avatarUrl) {
      return `${this.imageBaseUrl}${item.avatarUrl}`;
    }
    // For Chat, if no specific avatar, use default group or user image
    if ('isGroup' in item && item.isGroup) {
        return `${this.imageBaseUrl}/images/default/groupImage.png`;
    }
    // Default for user or private chat without specific avatar
    return `${this.imageBaseUrl}/images/default/userImage.png`;
  }

  getFileIcon(fileType: string | null | undefined): string {
    if (!fileType) {
      return 'bi bi-file-earmark'; // Generic file icon if type is unknown or null
    }

    // Convert to lowercase for case-insensitive comparison
    const lowerFileType = fileType.toLowerCase();

    // Image types
    if (lowerFileType.startsWith('image/')) {
      return 'bi bi-file-earmark-image';
    }
    // Video types
    else if (lowerFileType.startsWith('video/')) {
      return 'bi bi-file-earmark-play';
    }
    // Audio types
    else if (lowerFileType.startsWith('audio/')) {
      return 'bi bi-file-earmark-music';
    }
    // Document types
    else if (lowerFileType.includes('pdf')) {
      return 'bi bi-file-earmark-pdf';
    }
    // Word documents (.doc, .docx)
    else if (lowerFileType.includes('wordprocessingml') || lowerFileType.includes('msword')) {
      return 'bi bi-file-earmark-richtext'; // A good generic icon for Word documents
    }
    // Excel spreadsheets (.xls, .xlsx)
    else if (lowerFileType.includes('spreadsheetml') || lowerFileType.includes('excel')) {
      return 'bi bi-file-earmark-spreadsheet';
    }
    // PowerPoint presentations (.ppt, .pptx)
    else if (lowerFileType.includes('presentationml') || lowerFileType.includes('powerpoint')) {
      return 'bi bi-file-earmark-slides';
    }
    // Text files (.txt)
    else if (lowerFileType.includes('text/plain') || lowerFileType.includes('text/')) {
      return 'bi bi-file-earmark-text';
    }
    // Archive files (.zip, .rar, .tar, etc.)
    else if (lowerFileType.includes('zip') || lowerFileType.includes('rar') || lowerFileType.includes('tar')) {
      return 'bi bi-file-earmark-zip';
    }
    else if (lowerFileType.includes('json') || lowerFileType.includes('javascript') || lowerFileType.includes('html') || lowerFileType.includes('xml')) {
      return 'bi bi-file-earmark-code';
    }
    return 'bi bi-file-earmark';
  }
  scrollToBottom(): void {
    if (this.scrollContainer) {
      try {
        const element = this.scrollContainer.nativeElement;
        setTimeout(() => {
          element.scrollTop = element.scrollHeight;
        }, 0);
      } catch (err) {
        console.error('Could not scroll to bottom:', err);
      }
    }
  }
  onScroll(event: Event): void {
    const element = event.target as HTMLElement;

    const threshold = 100; // Pixels from the top
    if (element.scrollTop < threshold && !this.loadingMessages && !this.allMessagesLoaded) {
      console.log('Scrolled near top, loading more messages...');
      this.loadMoreMessages();
    }
  }
  removeAttachment(attachmentToRemove: FileAttachmentCreate): void {
    if (attachmentToRemove.fileUrl) {
      URL.revokeObjectURL(attachmentToRemove.fileUrl);
    }

    this.attachments = this.attachments.filter(att => att !== attachmentToRemove);
    this.sendMessageDto.attachments = [...this.attachments];

    if (this.attachments.length === 0 && this.fileInputRef && this.fileInputRef.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
    console.log('Attachment removed. Current attachments:', this.attachments);
  }
  getOtherParticipantUsername(chat: Chat): string {
    if (!chat || chat.isGroup || !this.currentUserId) {
      return '';
    }
    const otherParticipant = chat.participants.find(p => p.userId !== this.currentUserId);

    return otherParticipant ? otherParticipant.username : 'Unknown User';
  }
  isCurrentUserChatCreator(chat: Chat): boolean {
    if (!chat || !this.currentUserId) {
      return false;
    }
    if (chat.isGroup) {
      return false;
    }
    return chat.createdByUserId === this.currentUserId;
  }
  isCurrentUserRejectedInitiator(chat: Chat): boolean {
    if (!chat || !chat.participants || chat.status !== ChatStatus.Rejected) {
      return false;
    }
    const initiatorParticipant = chat.participants.find(p => p.isAdmin);
    return initiatorParticipant?.userId === this.currentUserId;
  }

  private updateHeaderVisibility(): void {
    const shouldHideHeader = this.isMobileView() && this.activeChat;
    this.headerService.setHeaderVisibility(!shouldHideHeader);
  }
  
  private handleChatLoadError(): void {
    this.activeChat = null;
    this.sendMessageDto.chatId = 0;
    this.isChatAreaVisibleOnMobile = false;
    this.headerService.setHeaderVisibility(true);
    this.updateMobileHeaderClass();
  }
  
  backToChatList(): void {
    this.isChatAreaVisibleOnMobile = false;
    this.activeChat = null;
    this.headerService.setHeaderVisibility(true);
    this.updateMobileHeaderClass();
  }
  
  isMobileView(): boolean {
    return window.matchMedia("(max-width: 991.98px)").matches;
  }
  
  private updateMobileHeaderClass(): void {
    const isSmallScreen = this.isMobileView();
    const shouldHideHeader = isSmallScreen && this.isChatAreaVisibleOnMobile && this.activeChat;
  
    if (shouldHideHeader) {
      this.renderer.addClass(this.document.body, 'chat-area-active-on-mobile');
    } else {
      this.renderer.removeClass(this.document.body, 'chat-area-active-on-mobile');
    }
  }


  
  setActiveChatUpdateTab(tab: string): void {
    this.activeChatUpdateTab = tab;
  }

  private initEditChatForm(): void {
    if (this.activeChat) {
      this.editChatForm.name = this.activeChat.name;
      this.editChatForm.avatarFile = null; 
      this.currentChatAvatarPreviewUrl = this.activeChat.avatarUrl
        ? `${this.imageBaseUrl}${this.activeChat.avatarUrl}`
        : 'assets/default-group-avatar.png';
    }
  }
  onChatAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.editChatForm.avatarFile = file;

      const reader = new FileReader();
      reader.onload = () => {
        this.currentChatAvatarPreviewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      this.editChatForm.avatarFile = null;
      this.currentChatAvatarPreviewUrl = this.activeChat?.avatarUrl
        ? `${this.imageBaseUrl}${this.activeChat.avatarUrl}`
        : 'assets/default-group-avatar.png';
    }
  }

  onUpdateChat(): void {
    if (!this.activeChat) {
      this.snackBar.open('No active chat selected.', 'Dismiss', { duration: 3000 });
      return;
    }

    const isNameChanged = this.activeChat.name !== this.editChatForm.name;
    const isAvatarChanged = this.editChatForm.avatarFile !== null;

    if (!isNameChanged && !isAvatarChanged) {
      this.snackBar.open('No changes detected.', 'Dismiss', { duration: 3000 });
      return;
    }

    const updatePayload: UpdateChat = {
      chatId: this.activeChat.id,
      name: isNameChanged ? this.editChatForm.name : undefined,
      avatarFile: isAvatarChanged ? this.editChatForm.avatarFile : undefined
    };

    this.chatService.updateChat(this.activeChat.id, updatePayload).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          this.snackBar.open('Chat updated successfully!', 'Close', {
            duration: 3000,
            panelClass: ['snackbar-success']
          });

          if (result.data) {
            // Update the activeChat immediately for the current user's view
            this.activeChat = result.data;
          }

          // --- IMPORTANT: Call loadChats() here to refresh the chat list ---
          // Reset pagination to ensure the updated chat is visible, especially if sorting applies.
          this.currentPage = 1; // Reset to the first page
          this.allLoaded = false; // Reset allLoaded flag
          this.chats = []; // Clear existing chats to ensure a full refresh from the beginning
          this.loadChats(); // Call your method to reload chats

          // Close modal after a short delay
          setTimeout(() => {
            this.closeChatUpdateModal();
          }, 1500);

        } else {
          const errorMessage = result.errorMessage || 'Failed to update chat due to an unknown error.';
          this.snackBar.open(errorMessage, 'Dismiss', {
            duration: 5000,
            panelClass: ['snackbar-error']
          });
        }
      },
      error: (err: HttpErrorResponse) => {
        const backendError = err.error?.errorMessage || 'An unexpected error occurred during chat update.';
        this.snackBar.open(backendError, 'Dismiss', {
          duration: 5000,
          panelClass: ['snackbar-error']
        });
        console.error('Error updating chat:', err);
      }
    });
  }
  isCurrentUserChatAdmin(chat: Chat | null): boolean {
    if (!chat || !this.currentUserId) {
      return false;
    }
    // For group chats, check the isAdmin flag of the current user's participant entry
    if (chat.isGroup) {
      const currentUserParticipant = chat.participants.find(
        (p) => p.userId === this.currentUserId
      );
      return currentUserParticipant?.isAdmin === true;
    }
    // For 1-on-1 chats, only the creator is considered "admin" for this purpose
    return chat.createdByUserId === this.currentUserId;
  }
  isCurrentUserChatOwner(chat: Chat | null): boolean {
    return chat?.createdByUserId === this.currentUserId;
  }
  formatDate(dateString: string | Date | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  get chatCreatorUsername(): string {
    if (!this.activeChat || !this.activeChat.isGroup || !this.activeChat.participants) {
      return 'N/A';
    }
    const creatorParticipant = this.activeChat.participants.find(
      p => p.userId === this.activeChat!.createdByUserId
    );
    // Corrected to directly access username from ChatParticipant
    return creatorParticipant?.username || 'N/A';
  }

  canRemoveMember(participantUserId: number): boolean {
    const isGroupChat = this.activeChat?.isGroup ?? false;
    const currentUserIsAdmin = this.isCurrentUserChatAdmin(this.activeChat) ?? false;
    return isGroupChat && currentUserIsAdmin && participantUserId !== this.currentUserId;
  }

  removeMember(userId: number): void {
    if (!this.activeChat) {
      this.snackBar.open('No active chat selected.', 'Dismiss', { duration: 3000 });
      return;
    }
  
    if (!this.canRemoveMember(userId)) {
      this.snackBar.open('You do not have permission to remove this member or you cannot remove yourself.', 'Dismiss', { duration: 3000 });
      return;
    }
  
    const participantName = this.activeChat.participants.find(p => p.userId === userId)?.username || 'this member';
  
    Swal.fire({
      title: `Remove ${participantName}?`,
      text: `Are you sure you want to remove ${participantName} from the group?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then(result => {
      if (result.isConfirmed && this.activeChat) {
        this.chatService.removeParticipant(this.activeChat.id, userId).subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.snackBar.open(`${participantName} removed successfully!`, 'Close', {
                duration: 3000,
                panelClass: ['snackbar-success']
              });
              this.activeChat!.participants = this.activeChat!.participants.filter(p => p.userId !== userId);
            } else {
              this.snackBar.open(res.errorMessage || `Failed to remove ${participantName}.`, 'Dismiss', {
                duration: 5000,
                panelClass: ['snackbar-error']
              });
            }
          },
          error: (err: HttpErrorResponse) => {
            const backendError = err.error?.errorMessage || 'An unexpected error occurred.';
            this.snackBar.open(backendError, 'Dismiss', {
              duration: 5000,
              panelClass: ['snackbar-error']
            });
            console.error('Error removing member:', err);
          }
        });
      }
    });
  }


  // Reset search state when chat changes or modal closes
  addMemberToChat(userId: number): void {
    if (!this.activeChat || this.isAddingMember) return;
  
    this.isAddingMember = true;
    this.userToAddId = userId; // Set ID to show spinner for this specific user
  
    this.chatService.addParticipant(this.activeChat.id, userId).subscribe({
      next: (result) => {
        // CORRECTED: Use `result.data` as per your `Result<T>` interface
        if (result.isSuccess && result.data) {
          this.snackBar.open(
            `${result.data.name} updated. User added successfully!`, // Use result.data.name
            'Dismiss',
            { duration: 3000 }
          );
          // Update the active chat directly with the new DTO from the service
          this.activeChat = result.data; // Use result.data
  
          // Re-filter the search results to remove the newly added user
          this.searchAddMembersResults = this.searchAddMembersResults.filter(
            (user) => user.id !== userId
          );
  
          // After successfully adding, reset the search to clear results and term
          this.resetAddMemberSearch();
        } else {
          console.error('Failed to add member:', result.errorMessage);
          this.snackBar.open(
            `Error adding member: ${result.errorMessage}`,
            'Dismiss',
            { duration: 5000 }
          );
        }
        this.isAddingMember = false;
        this.userToAddId = null; // Clear tracking ID
      },
      error: (err) => {
        console.error('Error adding member:', err);
        this.snackBar.open(
          'An unexpected error occurred while adding member.',
          'Dismiss',
          { duration: 5000 }
        );
        this.isAddingMember = false;
        this.userToAddId = null;
      },
    });
  }

  onAddMemberSearchTermChange(): void {
    this.addMemberSearchSubject.next(this.addMemberSearchTerm);
  }
  onAddMemberSearchScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (
      element.scrollHeight - element.scrollTop <= element.clientHeight + 1 &&
      !this.isSearchingAddMembers &&
      !this.allAddMembersLoaded
    ) {
      this.performUserSearch(this.addMemberSearchTerm, true, 'addMember'); // Load more users for add member
    }
  }

  // Helper to check if a user is already a participant in the current active chat
  isMemberAlreadyInChat(userId: number): boolean {
    return !!this.activeChat?.participants.some((p) => p.userId === userId);
  }
  resetAddMemberSearch(): void {
    this.addMemberSearchTerm = '';
    this.searchAddMembersResults = [];
    this.isSearchingAddMembers = false;
    this.addMemberSearchPageNumber = 1;
    this.allAddMembersLoaded = false;
    this.addMemberSearchSubject.next(''); // Clear any pending search
  }

  handleChatUpdated(updatedChat: Chat): void {
    console.log('Received ChatUpdated event from SignalR:', updatedChat);

    // 1. Update the currently active chat if it matches
    if (this.activeChat && this.activeChat.id === updatedChat.id) {
      this.activeChat = updatedChat;
      if (this.showChatUpdateModal && this.activeChatUpdateTab === 'members' && this.addMemberSearchTerm.trim() !== '') {
        this.performUserSearch(this.addMemberSearchTerm, false, 'addMember');
      }
    }

    // 2. Update or add the chat in the main chat list (sidebar)
    const chatIndex = this.chats.findIndex((c) => c.id === updatedChat.id);
    console.log("this is the updated chat " + updatedChat);
    

    if (chatIndex !== -1) {
      // Chat already exists in the list, update it
      const existingChat = this.chats[chatIndex];
      Object.assign(existingChat, updatedChat); // Merge updated properties

      if (
        updatedChat.lastMessage &&
        (!existingChat.lastMessage ||
          new Date(updatedChat.lastMessage.sentAt) >
            new Date(existingChat.lastMessage!.sentAt))
      ) {
        this.chats.splice(chatIndex, 1); // Remove from current position
        this.chats.unshift(existingChat); // Add to the beginning
      }
      // After an update, re-sort the entire list to maintain correct order
      this.sortChatsByLastMessage();

    } else {
      // Chat does NOT exist in the list. Check if the current user is a participant.
      const isCurrentUserParticipant = updatedChat.participants.some(
        (p) => p.userId === this.currentUserId
      );

      if (isCurrentUserParticipant) {
        // Add the new chat to the top of the chat list for the newly added user
        this.chats.unshift(updatedChat);
        // Sort to ensure the new chat is in the correct position
        this.sortChatsByLastMessage();
        console.log('New chat successfully added to UI list for current user via SignalR:', updatedChat.id);
      } else {
          console.warn('Received ChatUpdated for a chat not in list and current user is not a participant:', updatedChat.id);
      }
    }
  }

  private sortChatsByLastMessage(): void {
      this.chats.sort((a, b) => {
          const dateA = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : new Date(a.createdAt).getTime();
          const dateB = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : new Date(b.createdAt).getTime();
          return dateB - dateA; // Sort descending (most recent first)
      });
  }

  handleChatHeaderClick(): void {
    if (this.activeChat) {
      if (this.activeChat.isGroup) {
        this.openChatUpdateModal();
      } else {
        this.openOneOnOneChatInfoModal();
      }
    }
  }
  
  openChatUpdateModal(): void {
    if (this.activeChat?.isGroup) { // Only allow for group chats
      this.showChatUpdateModal = true;
      this.activeChatUpdateTab = 'info'; // Default to Group Info tab
      this.initEditChatForm(); // Initialize form values based on activeChat
      this.chatUpdateMessage = null;
      this.chatUpdateError = null;
      this.addMemberSearchTerm = ''; // Clear search when opening
      this.searchAddMembersResults = [];
      this.leaveGroupMessage = null;
      this.leaveGroupError = null;
      this.deleteChatMessage = null;
      this.deleteChatError = null;
      this.muteStatusMessage = null;
      this.muteStatusError = null;
    }
  }
  
  closeChatUpdateModal(): void {
    this.showChatUpdateModal = false;
    this.editChatForm = { name: null, avatarFile: null }; // Reset form
    this.currentChatAvatarPreviewUrl = null;
    this.chatUpdateMessage = null;
    this.chatUpdateError = null;
    // Reset messages related to actions that might happen within this modal
    this.leaveGroupMessage = null;
    this.leaveGroupError = null;
    this.deleteChatMessage = null;
    this.deleteChatError = null;
  }
  
  openOneOnOneChatInfoModal(): void {
    console.log("open");
    console.log(this.activeChat);
    console.log(this.currentUserId);
  
    if (this.activeChat && !this.activeChat.isGroup && this.currentUserId !== null) {
      // Find the other participant (not the current user)
      this.otherParticipant = this.activeChat.participants.find(
        p => p.userId !== this.currentUserId
      ) || null;
  
      if (this.otherParticipant) {
        // Use the UserService to check if the other user is blocked
        this.checkIfUserIsBlocked(this.otherParticipant.userId);
      }
  
      this.showOneOnOneChatInfoModal = true;
      this.blockUnblockMessage = null; // Clear messages on open
      this.blockUnblockError = null;
      this.muteStatusMessage = null; // Clear mute messages on open
      this.muteStatusError = null;
      console.log('One-on-one chat info modal opened.');
    }
  }
  
  closeOneOnOneChatInfoModal(): void {
    this.showOneOnOneChatInfoModal = false;
    this.otherParticipant = null;
    this.isOtherUserBlocked = false; // Reset block status on close
    this.blockUnblockMessage = null;
    this.blockUnblockError = null;
    this.muteStatusMessage = null; // Reset mute messages on close
    this.muteStatusError = null;
    console.log('One-on-one chat info modal closed.');
  }
  
  checkIfUserIsBlocked(userId: number): void {
    this.userService.isUserBlocked(userId).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data !== undefined && result.data !== null) { // Explicitly check for undefined and null
          this.isOtherUserBlocked = result.data; // Now result.data is guaranteed to be boolean
          console.log(`User ${userId} blocked status: ${this.isOtherUserBlocked}`);
        } else {
          console.error('Failed to get block status or data was null:', result.errorMessage);
          this.isOtherUserBlocked = false; // Default to false if data is null or not successful
          this.blockUnblockError = result.errorMessage || 'Failed to check block status.';
        }
      },
      error: (err) => {
        console.error('Error checking block status:', err);
        this.isOtherUserBlocked = false; // Default to false on HTTP error
        this.blockUnblockError = 'An unexpected error occurred while checking block status.';
      }
    });
  }
  
  blockUser(userId: number | undefined): void {
    if (!userId) return;
    this.blockUnblockMessage = null;
    this.blockUnblockError = null;
  
    this.userService.blockUser(userId).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data) {
          this.isOtherUserBlocked = true;
          this.blockUnblockMessage = 'User blocked successfully.';
          // You might want to refresh chat list or re-evaluate chat visibility here
        } else {
          this.blockUnblockError = result.errorMessage || 'Failed to block user.';
        }
      },
      error: (err) => {
        this.blockUnblockError = 'An error occurred while blocking the user.';
        console.error('Error blocking user:', err);
      }
    });
  }
  
  unblockUser(userId: number | undefined): void {
    if (!userId) return;
    this.blockUnblockMessage = null;
    this.blockUnblockError = null;
  
    this.userService.unblockUser(userId).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data) {
          this.isOtherUserBlocked = false;
          this.blockUnblockMessage = 'User unblocked successfully.';
          // You might want to refresh chat list or re-evaluate chat visibility here
        } else {
          this.blockUnblockError = result.errorMessage || 'Failed to unblock user.';
        }
      },
      error: (err) => {
        this.blockUnblockError = 'An error occurred while unblocking the user.';
        console.error('Error unblocking user:', err);
      }
    });
  }
  
  toggleMuteStatus(chatId: number, userId: number): void {
    if (!chatId || !userId) {
      this.muteStatusError = 'Chat ID or User ID is missing.';
      return;
    }
  
    this.muteStatusMessage = null; // Clear previous messages
    this.muteStatusError = null;   // Clear previous errors
  
    const dto: ToggleMuteStatus = { chatId, userId };
    this.chatService.toggleMuteStatus(dto).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          if (this.activeChat) {
            this.activeChat.isMutedForCurrentUser = !this.activeChat.isMutedForCurrentUser;
            this.muteStatusMessage = `Chat ${this.activeChat.isMutedForCurrentUser ? 'muted' : 'unmuted'} successfully.`;
          } else {
            console.warn('Mute status updated on server, but activeChat is null in UI.');
            this.muteStatusMessage = 'Mute status updated successfully, but UI could not be refreshed.';
          }
        } else {
          this.muteStatusError = result.errorMessage || 'Failed to toggle mute status.';
        }
      },
      error: (err) => {
        console.error('Error toggling mute status:', err);
        this.muteStatusError = 'An error occurred while toggling mute status.';
      }
    });
  }
  
  
  leaveGroupChat(chatId: number, userId: number): void {
    if (!chatId || !userId) {
      this.leaveGroupError = 'Chat ID or User ID is missing.';
      return;
    }
  
    this.leaveGroupMessage = null; // Clear previous messages
    this.leaveGroupError = null;   // Clear previous errors
  
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you really want to leave this group?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, leave it!',
    }).then((result) => {
      if (result.isConfirmed) {
        const dto: LeaveGroupChat = { chatId, userId };
        this.chatService.leaveGroupChat(dto).subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.leaveGroupMessage = 'You have successfully left the group.';
              this.closeChatUpdateModal(); // This will clear related messages
              Swal.fire('Left!', 'You have left the group.', 'success');
  
              this.removeChatFromList(chatId);
  
            } else {
              this.leaveGroupError = res.errorMessage || 'Failed to leave group.';
              Swal.fire('Error', this.leaveGroupError, 'error');
            }
          },
          error: (err) => {
            console.error('Error leaving group:', err);
            this.leaveGroupError = 'An error occurred while leaving the group.';
            Swal.fire('Error', this.leaveGroupError, 'error');
          }
        });
      }
    });
  }
  
  deleteChat(chatId: number, requestingUserId: number): void {
    if (!chatId || !requestingUserId) {
      this.deleteChatError = 'Chat ID or Requesting User ID is missing.';
      return;
    }
  
    this.deleteChatMessage = null; // Clear previous messages
    this.deleteChatError = null;   // Clear previous errors
  
    Swal.fire({
      title: 'Are you sure?',
      text: 'This action will delete the chat permanently!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e3342f',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
    }).then((result) => {
      if (result.isConfirmed) {
        const dto: DeleteChat = { chatId, requestingUserId };
        this.chatService.deleteChat(dto).subscribe({
          next: (res) => {
            if (res.isSuccess) {
              this.deleteChatMessage = 'Chat deleted successfully.';
              this.closeChatUpdateModal(); // This will clear related messages
              Swal.fire('Deleted!', 'Chat has been deleted.', 'success');
  
              this.removeChatFromList(chatId);
  
            } else {
              this.deleteChatError = res.errorMessage || 'Failed to delete chat.';
              Swal.fire('Error', this.deleteChatError, 'error');
            }
          },
          error: (err) => {
            console.error('Error deleting chat:', err);
            this.deleteChatError = 'An error occurred while deleting the chat.';
            Swal.fire('Error', this.deleteChatError, 'error');
          }
        });
      }
    });
  }
  
  private removeChatFromList(chatId: number): void {
    // Remove from the main chats list
    this.chats = this.chats.filter(chat => chat.id !== chatId);
    if (this.activeChat && this.activeChat.id === chatId) {
      this.activeChat = null;
    }
  
    this.searchResults = this.searchResults.filter(chat => chat.id !== chatId);
  
    this.chats.sort((a, b) => {
      const latestMsgA = a.lastMessage ? a.lastMessage.sentAt : a.createdAt;
      const latestMsgB = b.lastMessage ? b.lastMessage.sentAt : b.createdAt;
      return new Date(latestMsgB).getTime() - new Date(latestMsgA).getTime();
    });
  }
  

}




