import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, map, catchError, of } from 'rxjs';
import { UserService } from '../app/Services/user.service';

export const adminGuard: CanActivateFn = (route, state): Observable<boolean> => {
  const userService = inject(UserService);
  const router = inject(Router);

  return userService.getUserById().pipe(
    map((res) => {
      const role = res.data?.role?.toLowerCase();
      if (role === 'admin') {
        return true;
      } else {
        router.navigate(['/not-found']); 
        return false;
      }
    }),
    catchError((err) => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};
