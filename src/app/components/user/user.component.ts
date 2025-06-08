import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router'; // Added RouterLink
import { UserService } from '../../services/user.service';
import { SignalrService } from '../../services/signalr.service';

@Component({
  selector: 'app-user', // Selector remains 'app-user'
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink // Added RouterLink for navigation to register page
  ],
  templateUrl: './user.component.html', // Template URL remains './user.component.html'
  styleUrl: './user.component.css' // Style URL remains './user.component.css'
})
export class UserComponent { // Class name remains UserComponent
  userNameOrEmail: string = '';
  password: string = '';
  loginError: boolean = false;
  showPassword: boolean = false;
  isLoading: boolean = false;

  // Features array copied from register.component.ts for the marketing section
  features = [
    { icon: 'bi-chat-dots', title: 'Real-time Messaging', description: 'Instant communication with friends and colleagues' },
    { icon: 'bi-people', title: 'Group Chats', description: 'Create and manage group conversations effortlessly' },
    { icon: 'bi-lightning', title: 'Lightning Fast', description: 'Optimized for speed and performance' },
    { icon: 'bi-image', title: 'Rich Media Sharing', description: 'Share photos, videos, and files seamlessly in your chats' },
    { icon: 'bi-globe', title: 'Global Reach', description: 'Connect with people around the world' },
    { icon: 'bi-heart', title: 'Made with Love', description: 'Crafted with attention to every detail' }
  ];

  constructor(
    private userService: UserService,
    private signalRService: SignalrService,
    private router: Router
  ) {}

  onSubmit(loginForm: NgForm): void {
    if (!loginForm.valid) {
      // Mark all fields as touched to show validation errors immediately
      Object.keys(loginForm.controls).forEach(field => {
        const control = loginForm.controls[field];
        control.markAsTouched({ onlySelf: true });
      });
      return;
    }

    this.isLoading = true;
    this.loginError = false; // Reset error on new submission

    this.userService.login({
      userNameOrEmail: this.userNameOrEmail,
      password: this.password
    }).subscribe({
      next: (result) => {
        this.isLoading = false;

        if (result.isSuccess && result.data) {
          console.log('Login successful:', result.data);
          // Connect to SignalR once login is successful
          this.signalRService.startConnection();

          // Navigate to chat after SignalR is connected
          this.router.navigate(['/chat']); // Adjust route as needed
        } else {
          console.error('Login failed:', result.errorMessage);
          this.loginError = true; // Show generic error message
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.loginError = true; // Show generic error message for HTTP errors
        console.error('HTTP Error during login:', error);
        // You can add more specific error handling based on `error.status` or `error.error` if needed
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
    // Removed setTimeout with feather.replace() as it's not needed with Bootstrap Icons (bi-eye)
  }
}