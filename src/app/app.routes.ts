import { Routes } from '@angular/router';
import { UserComponent } from './components/user/user.component';
import { ChatComponent } from './components/chat/chat.component';
import { authGuard } from './guards/auth.guard';
import { RegisterComponent } from './components/register/register.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: UserComponent },
  {
    path: 'chat',
    component: ChatComponent,
    canActivate: [authGuard]
  },
  {
    path: 'chat/:id', 
    component: ChatComponent,
    canActivate: [authGuard]
  },
  {
    path: 'register', 
    component: RegisterComponent
  },
  { path: '**', redirectTo: 'login' }
];