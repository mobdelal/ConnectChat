import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserService } from '../app/Services/user.service';
import { jwtDecode } from 'jwt-decode'; // Consistent import

@Injectable({ providedIn: 'root' })
export class NonAdminGuard implements CanActivate {
  constructor(private userService: UserService, private router: Router) {}

  canActivate(): boolean {
    const token = this.userService.getToken();
    if (!token) {
      this.router.navigate(['/login']);
      return false;
    }

    try {
      const decoded: any = jwtDecode(token);
      const role = decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      
      if (role === 'Admin') {
        this.router.navigate(['/users']);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error decoding token', error);
      this.router.navigate(['/login']);
      return false;
    }
  }
}