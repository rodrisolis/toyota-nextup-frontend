import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EmailService {
  private apiUrl = 'https://outlook-api-mailer--nextup2.us-east4.hosted.app/api/send-email';

  constructor(private http: HttpClient) {}

  sendCustomEmail(subject: string, body: string, to: string): Observable<any> {
    const payload = {
      subject,
      body,
      to,
      isBodyHtml: true,
      from: 'updates@daltoncorp.com',
    };
    return this.http.post(this.apiUrl, payload);
  }
}