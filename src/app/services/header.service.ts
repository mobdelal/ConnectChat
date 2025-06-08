import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HeaderService {
  private _isHeaderVisible = new BehaviorSubject<boolean>(true);
  isHeaderVisible$ = this._isHeaderVisible.asObservable();

  constructor() { }

  setHeaderVisibility(visible: boolean): void {
    this._isHeaderVisible.next(visible);
  }
}
