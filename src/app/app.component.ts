  import { Component } from '@angular/core';
  import { RouterOutlet } from '@angular/router';
  import { Subscription } from 'rxjs';
  import { UserService } from './services/user.service';
  import { HeaderService } from './services/header.service';

  @Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
  })
  export class AppComponent {
    title = 'Chat';
    isLoggedIn: boolean = false;
    private loginSubscription!: Subscription;
    isHeaderVisible: boolean = true;
    private headerSubscription!: Subscription; 
    constructor(private userService: UserService, private headerService: HeaderService) {}

    ngOnInit(): void {
      this.loginSubscription = this.userService.loggedIn$.subscribe(status => {
        this.isLoggedIn = status;
      });
      this.headerSubscription = this.headerService.isHeaderVisible$.subscribe(
        (visible) => {
          this.isHeaderVisible = visible;
        }
      );
    }

    ngOnDestroy(): void {
      this.loginSubscription.unsubscribe();
      if (this.headerSubscription) {
        this.headerSubscription.unsubscribe();
      }
    }
  }
