import { Component, OnInit, OnDestroy, Output, EventEmitter, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, finalize } from 'rxjs/operators';
import { User } from '../../models/user';
import { UserDetails } from '../../models/user-details';
import { UserService } from '../../services/user.service';
import { environment } from '../../../environments/environment.development';
import { UpdateUser } from '../../models/update-user';
import { ChangePassword } from '../../models/change-password';
import { ChatService } from '../../services/chat.service';
import { Router } from '@angular/router';
import { CreateChat } from '../../models/create-chat';
import { Chat, ChatStatus } from '../../models/chat';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BlockedUserPaged } from '../../models/blocked-user-paged';
import { SingleBlockedUser } from '../../models/blocked-user';
import { SignalrService } from '../../services/signalr.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {

  searchTerm: string = '';
  searchResults: User[] = [];
  showSearchResults: boolean = false;
  isLoadingSearch: boolean = false;
  imageBaseUrl = environment.ImageLinl;

  currentUserDetails: UserDetails | null = null;
  private currentUserId!: number;

  showProfileModal: boolean = false;
  editProfileForm: UpdateUser = {
    receiveNotifications: false
  };
  profileUpdateMessage: string = '';
  profileUpdateError: string = '';

  selectedAvatarFile: File | null = null;
  currentAvatarPreviewUrl: string = 'assets/default-avatar.png';

  activeTab: 'profile' | 'password' | 'blocked-rejected' = 'profile';
  changePasswordForm: ChangePassword = {
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  };
  passwordUpdateMessage: string = '';
  passwordUpdateError: string = '';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmNewPassword = false;

  private searchSubject = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  private ignoreNextClick: boolean = false;

  currentPage: number = 1;
  pageSize: number = 10; // For search results
  allUsersLoaded: boolean = false;
  isLoadingMoreUsers: boolean = false;

  @ViewChild('searchResultsDropdown') searchResultsDropdown!: ElementRef;

  blockedUsers: SingleBlockedUser[] = []; 
  totalBlockedUsers: number = 0;

  blockedUsersPage: number = 1;
  blockedUsersPageSize: number = 10; // Consistent page size for blocked users
  blockedUsersAllLoaded: boolean = false;
  isLoadingBlockedUsers: boolean = false;

  @ViewChild('blockedUsersList') blockedUsersListElement!: ElementRef;
  // --- END MODIFIED PROPERTIES ---

  constructor(
    private userService: UserService,
    private chatService: ChatService,
    private elementRef: ElementRef,
    private router: Router,
    private snackBar: MatSnackBar,
    private signalrService: SignalrService
  ) { }

  ngOnInit(): void {
    this.getCurrentUserDetails();

    const userIdFromToken = this.userService.getUserIdFromToken();
    if (userIdFromToken !== null && userIdFromToken !== undefined) {
      this.currentUserId = userIdFromToken;
    } else {
      console.error('User ID not available from token. Cannot initiate chat.');
      this.snackBar.open('Error: Your session expired. Please log in again.', 'Close', { duration: 5000 });
    }

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        this.currentPage = 1;
        this.allUsersLoaded = false;
        this.searchResults = [];

        if (term.trim().length < 2) {
          this.isLoadingSearch = false;
          this.showSearchResults = false;
          return of(null);
        }

        this.isLoadingSearch = true;
        this.showSearchResults = true;

        return this.userService.searchUsers(term, this.currentPage, this.pageSize).pipe(
          finalize(() => this.isLoadingSearch = false),
          catchError(error => {
            console.error('Error during user search:', error);
            this.searchResults = [];
            this.showSearchResults = false;
            return of(null);
          })
        );
      })
    ).subscribe(result => {
      this.isLoadingSearch = false;

      if (result && result.isSuccess && result.data) {
        this.searchResults = result.data || [];
        this.allUsersLoaded = result.data.length < this.pageSize;
        console.log('API Search Result:', result);
      } else {
        this.searchResults = [];
        this.allUsersLoaded = true;
      }
      this.showSearchResults = this.searchResults.length > 0 || this.searchTerm.trim().length >= 2;
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  getCurrentUserDetails(): void {
    this.userService.getCurrentUserDetails().subscribe({
      next: (response) => {
        if (response.isSuccess && response.data) {
          console.log(response.data);
          this.currentUserDetails = response.data;
          this.editProfileForm = {
            username: this.currentUserDetails.username,
            receiveNotifications: this.currentUserDetails.receiveNotifications ?? false
          };
          this.currentAvatarPreviewUrl = this.currentUserDetails.avatarUrl
            ? this.imageBaseUrl + this.currentUserDetails.avatarUrl
            : 'assets/default-avatar.png';
        } else {
          console.error('Failed to load current user details:', response.errorMessage);
          this.currentUserDetails = null;
          this.currentAvatarPreviewUrl = 'assets/default-avatar.png';
        }
      },
      error: (err) => {
        console.error('Error fetching current user details:', err);
        this.currentUserDetails = null;
        this.currentAvatarPreviewUrl = 'assets/default-avatar.png';
      }
    });
  }

  openProfileModal(): void {
    this.profileUpdateMessage = '';
    this.profileUpdateError = '';
    this.passwordUpdateMessage = '';
    this.passwordUpdateError = '';
    this.selectedAvatarFile = null;
    this.activeTab = 'profile'; // Default to profile tab on open

    // Reset and load data for Blocked tab if user ID is available
    this.resetBlockedUsersList(); // Only reset blocked users
    if (this.currentUserId) {
      this.loadBlockedUsers(); // Load initial blocked users
    }

    console.log('openProfileModal called. Current showProfileModal:', this.showProfileModal);

    if (this.currentUserDetails) {
      this.editProfileForm = {
        username: this.currentUserDetails.username,
        receiveNotifications: this.currentUserDetails.receiveNotifications ?? false
      };
      this.currentAvatarPreviewUrl = this.currentUserDetails.avatarUrl
        ? this.imageBaseUrl + this.currentUserDetails.avatarUrl
        : 'assets/default-avatar.png';

      this.changePasswordForm = {
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      };
      this.showCurrentPassword = false;
      this.showNewPassword = false;
      this.showConfirmNewPassword = false;

      this.showProfileModal = true;
      this.ignoreNextClick = true;
      console.log('Modal should be open. showProfileModal:', this.showProfileModal);
    } else {
      console.warn('Cannot open profile modal: currentUserDetails not loaded. Attempting refetch.');
      this.getCurrentUserDetails();
    }
  }

  closeProfileModal(): void {
    console.log('closeProfileModal called. Current showProfileModal:', this.showProfileModal);
    this.showProfileModal = false;
    this.selectedAvatarFile = null;
    this.profileUpdateMessage = '';
    this.profileUpdateError = '';
    this.passwordUpdateMessage = '';
    this.passwordUpdateError = '';
    this.resetBlockedUsersList(); // Reset lists when closing modal
    console.log('Modal should be closed. showProfileModal:', this.showProfileModal);
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedAvatarFile = input.files[0];

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.currentAvatarPreviewUrl = e.target.result;
      };
      reader.readAsDataURL(this.selectedAvatarFile);
    } else {
      this.selectedAvatarFile = null;
      this.currentAvatarPreviewUrl = this.currentUserDetails?.avatarUrl
        ? this.imageBaseUrl + this.currentUserDetails.avatarUrl
        : 'assets/default-avatar.png';
    }
  }

  onUpdateProfile(): void {
    this.profileUpdateMessage = '';
    this.profileUpdateError = '';

    const formData = new FormData();

    if (this.editProfileForm.username !== undefined && this.editProfileForm.username !== null) {
      formData.append('username', this.editProfileForm.username);
    }
    if (this.editProfileForm.receiveNotifications !== undefined) {
      formData.append('receiveNotifications', this.editProfileForm.receiveNotifications.toString());
    }
    if (this.selectedAvatarFile) {
      formData.append('avatarFile', this.selectedAvatarFile, this.selectedAvatarFile.name);
    }

    this.userService.updateProfile(formData).subscribe({
      next: (response) => {
        if (response.isSuccess) {
          this.profileUpdateMessage = 'Profile updated successfully!';
          this.getCurrentUserDetails();
          this.selectedAvatarFile = null;
          setTimeout(() => {
            this.closeProfileModal();
          }, 1500);
        } else {
          this.profileUpdateError = response.errorMessage || 'Failed to update profile.';
        }
      },
      error: (err) => {
        console.error('Error during profile update:', err);
        this.profileUpdateError = err.error?.errorMessage || err.error?.title || 'An unexpected error occurred during profile update.';
      }
    });
  }

  onChangePassword(): void {
    this.passwordUpdateMessage = '';
    this.passwordUpdateError = '';

    if (this.changePasswordForm.newPassword !== this.changePasswordForm.confirmNewPassword) {
      this.passwordUpdateError = 'New password and confirmation do not match.';
      return;
    }

    this.userService.changePassword(this.changePasswordForm).subscribe({
      next: (response) => {
        if (response.isSuccess) {
          this.passwordUpdateMessage = 'Password updated successfully!';
          this.changePasswordForm = {
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: ''
          };
          this.showCurrentPassword = false;
          this.showNewPassword = false;
          this.showConfirmNewPassword = false;

          setTimeout(() => {
            this.closeProfileModal();
          }, 1500);
        } else {
          this.passwordUpdateError = response.errorMessage || 'Failed to change password.';
        }
      },
      error: (err) => {
        console.error('Error changing password:', err);
        this.passwordUpdateError = err.error?.errorMessage || err.error?.title || 'An unexpected error occurred while changing password.';
      }
    });
  }

  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword = !this.showCurrentPassword;
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmNewPasswordVisibility(): void {
    this.showConfirmNewPassword = !this.showConfirmNewPassword;
  }

  onSearchInputChange(): void {
    this.searchSubject.next(this.searchTerm);

    if (this.searchTerm.trim().length < 2) {
      this.showSearchResults = false;
      this.searchResults = [];
      this.allUsersLoaded = false;
      this.currentPage = 1;
    } else {
      this.showSearchResults = true;
    }
  }

  onUserClick(user: User): void {
    this.searchTerm = '';
    this.searchResults = [];
    this.showSearchResults = false;
    this.allUsersLoaded = false;
    this.currentPage = 1;
  }

  startOneOnOneChat(targetUser: User): void {
    this.showSearchResults = false;
    this.searchTerm = '';
    this.searchResults = [];

    if (!this.currentUserId) {
      this.snackBar.open('Error: Your user session is not active. Please log in again.', 'Close', { duration: 5000 });
      return;
    }

    const createChatDto: CreateChat = {
      name: null,
      isGroup: false,
      createdByUserId: this.currentUserId,
      participantIds: [targetUser.id],
      avatarUrl: null
    };

    this.chatService.createChat(createChatDto).subscribe({
      next: (result) => {
        if (result.isSuccess && result.data) {
          const newChat = result.data;
          console.log('Chat creation/check successful:', newChat);

          if (newChat.status === ChatStatus.Pending) {
            this.snackBar.open(`Chat invitation sent to ${targetUser.username}. They need to accept to start chatting.`, 'Close', { duration: 7000 });
          } else if (newChat.status === ChatStatus.Active) {
            this.snackBar.open(`Chat with ${targetUser.username} is already active!`, 'Close', { duration: 5000 });
          } else {
            this.snackBar.open(`Chat status: ${ChatStatus[newChat.status]}. Something unexpected happened.`, 'Close', { duration: 7000 });
          }
          this.router.navigate(['/chat', newChat.id]);

        } else {
          console.error('Failed to create/check chat:', result.errorMessage);
          this.snackBar.open(`Error: ${result.errorMessage || 'Could not initiate chat.'}`, 'Close', { duration: 7000 });
        }
      },
      error: (err) => {
        console.error('API Error during chat initiation:', err);
        const errorMessage = err.error?.errorMessage || err.error?.title || 'An unexpected error occurred while trying to start the chat.';
        this.snackBar.open(errorMessage, 'Close', { duration: 7000 });
      }
    });

    console.log(`Attempting to initiate chat with: ${targetUser.username} (ID: ${targetUser.id})`);
  }


  @HostListener('document:click', ['$event'])
  clickout(event: MouseEvent) {
    if (this.ignoreNextClick) {
      this.ignoreNextClick = false;
      return;
    }

    setTimeout(() => {
      const clickedInsideHeaderComponent = this.elementRef.nativeElement.contains(event.target);
      const modalElement = this.elementRef.nativeElement.querySelector('.modal-content');
      const profileButton = this.elementRef.nativeElement.querySelector('.profile-button');


      const clickedInsideModal = modalElement ? modalElement.contains(event.target) : false;
      const clickedOnProfileButton = profileButton ? profileButton.contains(event.target) : false;


      if (this.showSearchResults && !clickedInsideHeaderComponent && !clickedInsideModal) {
        this.showSearchResults = false;
        this.searchResults = [];
        this.allUsersLoaded = false;
        this.currentPage = 1;
      }

      if (this.showProfileModal && !clickedInsideModal && !clickedOnProfileButton) {
        this.closeProfileModal();
      }
    }, 50);
  }

  onSearchFocus(): void {
    if (this.searchTerm.trim().length >= 2 || this.searchResults.length > 0) {
      this.showSearchResults = true;
    }
  }

  // --- MODIFIED setActiveTab to load data when 'blocked-rejected' tab is active ---
  setActiveTab(tab: 'profile' | 'password' | 'blocked-rejected'): void {
    this.activeTab = tab;
    this.profileUpdateMessage = '';
    this.profileUpdateError = '';
    this.passwordUpdateMessage = '';
    this.passwordUpdateError = '';

    if (this.activeTab === 'blocked-rejected') {
      this.resetBlockedUsersList(); // Only reset blocked users list
      this.loadBlockedUsers(); // Load initial blocked users
    }
  }

  onSearchResultsScroll(event: Event): void {
    const element = this.searchResultsDropdown.nativeElement;

    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 1 &&
      !this.isLoadingMoreUsers &&
      !this.allUsersLoaded &&
      this.searchTerm.trim().length >= 2) {

      this.isLoadingMoreUsers = true;
      this.currentPage++;

      this.userService.searchUsers(this.searchTerm, this.currentPage, this.pageSize).pipe(
        finalize(() => this.isLoadingMoreUsers = false),
        catchError(error => {
          console.error('Error loading more users:', error);
          this.isLoadingMoreUsers = false;
          return of(null);
        })
      ).subscribe(result => {
        if (result && result.isSuccess && result.data) {
          if (result.data.length > 0) {
            this.searchResults = [...this.searchResults, ...result.data];
          } else {
            this.allUsersLoaded = true;
          }
        } else {
          this.allUsersLoaded = true;
        }
      });
    }
  }

  // --- NEW/MODIFIED METHODS FOR BLOCKED USERS ONLY ---

  private resetBlockedUsersList(): void {
    this.blockedUsers = [];
    this.totalBlockedUsers = 0;
    this.blockedUsersPage = 1;
    this.blockedUsersAllLoaded = false;
    this.isLoadingBlockedUsers = false;
  }

  private loadBlockedUsers(): void {
    // Only load initial blocked users if not already loading and not all loaded
    if (!this.blockedUsersAllLoaded && !this.isLoadingBlockedUsers) {
      this.loadMoreBlockedUsers();
    }
  }

  loadMoreBlockedUsers(): void {
    if (this.isLoadingBlockedUsers || this.blockedUsersAllLoaded) {
      return;
    }

    this.isLoadingBlockedUsers = true;
    this.userService.getBlockedUsers(
      this.blockedUsersPage,
      this.blockedUsersPageSize
    ).pipe(
      finalize(() => this.isLoadingBlockedUsers = false),
      catchError(error => {
        console.error('Error loading more blocked users:', error);
        this.snackBar.open('Error loading blocked users.', 'Close', { duration: 3000 });
        return of(null);
      })
    ).subscribe(result => {
      if (result && result.isSuccess && result.data) {
        if (result.data.items && result.data.items.length > 0) {
          this.blockedUsers = [...this.blockedUsers, ...result.data.items];
          this.blockedUsersPage++;
          this.totalBlockedUsers = result.data.totalCount;
          this.blockedUsersAllLoaded = this.blockedUsers.length >= this.totalBlockedUsers;
        } else {
          this.blockedUsersAllLoaded = true; // No more items on this page
        }
      } else {
        this.blockedUsersAllLoaded = true; // No success or no data, consider all loaded
      }
    });
  }

  onBlockedListScroll(event: Event): void {
    const element = this.blockedUsersListElement.nativeElement;
    // Check if scrolled to bottom
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 1 && !this.blockedUsersAllLoaded && !this.isLoadingBlockedUsers) {
      this.loadMoreBlockedUsers();
    }
  }

  // NEW METHOD TO UNBLOCK USER
  unblockUser(blockedUserId: number): void {

    this.userService.unblockUser(blockedUserId).subscribe({
      next: (result) => {
        if (result.isSuccess) {
          this.snackBar.open('User unblocked successfully!', 'Close', { duration: 3000 });
          // After successful unblock, refresh the list of blocked users
          this.resetBlockedUsersList();
          this.loadBlockedUsers();
        } else {
          this.snackBar.open(result.errorMessage || 'Failed to unblock user.', 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error('Error unblocking user:', err);
        this.snackBar.open('An error occurred while unblocking user.', 'Close', { duration: 3000 });
      }
    });
  }

  onLogout(): void {
    // Step 1: Stop the SignalR connection
    this.signalrService.stopConnection();
    console.log('SignalR connection stopped during logout.');

    this.userService.logout();
    console.log('User session cleared.');

    this.router.navigate(['/login']); // Ensure '/login' is the correct path in your routes.ts
    console.log('Redirecting to login page.');
  }
}