import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService } from '../../services/user.service'; // Assuming UserService handles registration
import { RegisterDTO } from '../../models/register-dto';

interface RegistrationFormData {
  userName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  avatar: File | null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  formData: RegistrationFormData = { // Using the extended interface
    userName: '',
    email: '',
    password: '',
    confirmPassword: '', // Initialize confirmPassword
    avatar: null,
  };

  showPassword = false; // Controls visibility for the first password input
  showConfirmPassword = false; // Controls visibility for the confirm password input
  avatarPreview: string | ArrayBuffer | null = null;
  submissionErrors: string[] = [];
  formSubmitted = false;
  passwordMismatch = false; // New property to track password mismatch

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
    private router: Router
  ) { }

  ngOnInit(): void {
  }

  handleAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.formData.avatar = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      this.formData.avatar = null;
      this.avatarPreview = null;
    }
  }

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.formSubmitted = true;
    this.submissionErrors = [];
    this.passwordMismatch = false; // Reset mismatch error on new submission

    const form = event.target as HTMLFormElement;

    // Manual check for password mismatch before checking form validity
    if (this.formData.password !== this.formData.confirmPassword) {
      this.passwordMismatch = true;
      // Add a generic error to submissionErrors or handle it visually through the invalid-feedback
      this.submissionErrors.push('Passwords do not match.');
      // Prevent further submission if passwords don't match
      return;
    }

    if (form.checkValidity()) {
      // Create a DTO without the confirmPassword field if your backend doesn't expect it
      const registerDTO: RegisterDTO = {
        userName: this.formData.userName,
        email: this.formData.email,
        password: this.formData.password,
        avatar: this.formData.avatar,
      };

      this.userService.register(registerDTO).subscribe({
        next: (response) => {
          if (response.isSuccess) {
            console.log('Registration successful:', response.data);
            this.router.navigate(['/login']);
          } else {
            console.error('Registration failed:', response.errorMessage);
            if (response.errorMessage) {
              this.submissionErrors = [response.errorMessage];
            } else {
              this.submissionErrors = ['An unknown error occurred during registration.'];
            }
          }
        },
        error: (error: HttpErrorResponse) => {
          console.error('HTTP Error during registration:', error);

          if (error.error && error.error.errorMessage) {
            this.submissionErrors = [error.error.errorMessage];
          } else if (error.error && error.error.errors) {
            this.submissionErrors = Object.values(error.error.errors).flatMap((err: any) => err);
          } else if (error.message) {
            this.submissionErrors = [`Server error: ${error.message}`];
          } else {
            this.submissionErrors = ['Failed to connect to the server. Please check your internet connection or try again later.'];
          }
        }
      });
    } else {
      console.log('Client-side form validation failed.');
    }
  }
}