export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  avatarUrl: string;
}

export type GoogleAuthStatus =
  | 'enabled'
  | 'authlib_missing'
  | 'missing_credentials'
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'oauth_client_unavailable';

export interface SessionPayload {
  authenticated: boolean;
  user: SessionUser | null;
  registrationEnabled: boolean;
  googleAuthEnabled: boolean;
  googleAuthStatus: GoogleAuthStatus;
  csrfToken: string;
}

export interface ChronicleSummary {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  authorName: string;
  publishedLabel: string;
}

export interface ChronicleComment {
  id: string;
  textHtml: string;
  authorName: string;
  authorEmail: string;
  avatarUrl: string;
  timestampLabel: string | null;
}

export interface ChronicleDetail extends ChronicleSummary {
  bodyHtml: string;
  comments: ChronicleComment[];
  canEdit: boolean;
  canDelete: boolean;
}

export interface ChroniclePayload {
  title: string;
  description: string;
  loreText: string;
  imageSrc: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export interface ContactResponse {
  sent: boolean;
  message: string;
}

export interface ApiErrorResponse {
  error: string;
  fieldErrors?: Record<string, string[]>;
}
