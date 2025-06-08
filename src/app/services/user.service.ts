import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';
import { Result } from '../models/result';
import { jwtDecode } from 'jwt-decode';
import { User } from '../models/user';
import { ChangePassword } from '../models/change-password';
import { UpdateUser } from '../models/update-user';
import { UserDetails } from '../models/user-details';
import { UserRelationshipStatus } from '../models/user-relationship-status';
import { BlockingUserPaged } from '../models/blocking-user-paged';
import { BlockedUserPaged } from '../models/blocked-user-paged';
import { RegisterDTO } from '../models/register-dto';


@Injectable({
  providedIn: 'root'
})
export class UserService {

  private apiUrl: string = `${environment.ResUrl}/user`;
  public tokenKey = 'auth_token';
  private isLoggedInKey = 'isLoggedIn';

  private _loggedIn = new BehaviorSubject<boolean>(this.hasToken());
  public loggedIn$ = this._loggedIn.asObservable();

  constructor(private http: HttpClient) { }

  login(credentials: { userNameOrEmail: string; password: string }): Observable<Result<string>> {
    return this.http.post<Result<string>>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        if (response.isSuccess && response.data) {
          this.storeToken(response.data); 
          sessionStorage.setItem(this.isLoggedInKey, 'true');
          this._loggedIn.next(true);
        }
      })
    );
  }

  logout(): void {
    this.removeToken();
    sessionStorage.removeItem(this.isLoggedInKey);
    this._loggedIn.next(false);
  }
  private removeToken(): void {
    sessionStorage.removeItem(this.tokenKey);
  }

  storeToken(token: string) {
    sessionStorage.setItem(this.tokenKey, token);
  }

  private hasToken(): boolean {
    return !!sessionStorage.getItem(this.tokenKey);
  }

  getUserIdFromToken(): number | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }
  
    try {
      const decoded: any = jwtDecode(token);  
      return decoded.id ? parseInt(decoded.id, 10) : null;  
    } catch (error) {
      console.error('Error decoding token', error);
      return null;
    }
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return this.hasToken();
  }

  searchUsers(
    searchTerm: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<Result<User[]>> {
    let params = new HttpParams();

    if (searchTerm && searchTerm.trim() !== '') {
      params = params.set('searchTerm', searchTerm.trim());
    }
    params = params.set('pageNumber', pageNumber.toString());
    params = params.set('pageSize', pageSize.toString());

    return this.http.get<Result<User[]>>(`${this.apiUrl}/search`, { params });
  }

  changePassword(dto: ChangePassword): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${this.apiUrl}/change-password`, dto);
  }

  updateProfile(formData: FormData): Observable<Result<boolean>> {
    return this.http.put<Result<boolean>>(`${this.apiUrl}/profile`, formData);
  }
  
  getCurrentUserDetails(): Observable<Result<UserDetails>> {
    return this.http.get<Result<UserDetails>>(`${this.apiUrl}/me`);
  }
  getUserRelationshipStatus(
    pageNumberBlocked: number = 1,
    pageSizeBlocked: number = 10,
    pageNumberRejected: number = 1,
    pageSizeRejected: number = 10
  ): Observable<Result<UserRelationshipStatus>> {
    let params = new HttpParams();
    params = params.set('pageNumberBlocked', pageNumberBlocked.toString());
    params = params.set('pageSizeBlocked', pageSizeBlocked.toString());
    params = params.set('pageNumberRejected', pageNumberRejected.toString());
    params = params.set('pageSizeRejected', pageSizeRejected.toString());

    return this.http.get<Result<UserRelationshipStatus>>(`${this.apiUrl}/relationship-status`, { params });
  }


  getBlockedUsers(
    pageNumber: number = 1,
    pageSize: number = 10
  ): Observable<Result<BlockedUserPaged>> {
    let params = new HttpParams();
    params = params.set('pageNumber', pageNumber.toString());
    params = params.set('pageSize', pageSize.toString());

    return this.http.get<Result<BlockedUserPaged>>(`${this.apiUrl}/blocked`, { params });
  }
  getBlockingUsers(
    pageNumber: number = 1,
    pageSize: number = 10
  ): Observable<Result<BlockingUserPaged>> {
    let params = new HttpParams();
    params = params.set('pageNumber', pageNumber.toString());
    params = params.set('pageSize', pageSize.toString());

    return this.http.get<Result<BlockingUserPaged>>(`${this.apiUrl}/blocked-by`, { params });
  }

  blockUser(blockedUserId: number): Observable<Result<boolean>> {
    return this.http.post<Result<boolean>>(`${this.apiUrl}/block`, blockedUserId);
  }

  unblockUser(unblockUserId: number): Observable<Result<boolean>> {
    return this.http.delete<Result<boolean>>(`${this.apiUrl}/unblock/${unblockUserId}`);
  }

  isUserBlocked(otherUserId: number): Observable<Result<boolean>> {
    let params = new HttpParams().set('otherUserId', otherUserId.toString());
    return this.http.get<Result<boolean>>(`${this.apiUrl}/is-blocked`, { params });
  }

  register(registerData: RegisterDTO): Observable<Result<string>> {
    const formData = new FormData();

    // Append text fields first
    formData.append('Username', registerData.userName); 
    formData.append('Email', registerData.email);    
    formData.append('Password', registerData.password); 

    if (registerData.avatar) {
      formData.append('Avatar', registerData.avatar, registerData.avatar.name); // Match C# property name: Avatar
    }

    return this.http.post<Result<string>>(`${this.apiUrl}/register`, formData).pipe(
      tap(response => {
        // Optionally, if registration automatically logs in the user, store the token
        if (response.isSuccess && response.data) {
          this.storeToken(response.data);
          sessionStorage.setItem(this.isLoggedInKey, 'true');
          this._loggedIn.next(true);
        }
      })
    );
  }

}