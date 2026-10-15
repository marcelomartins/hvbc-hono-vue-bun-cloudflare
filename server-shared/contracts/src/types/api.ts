export interface ApiErrorBody {
  error: {
    code: string;
    requestId: string;
    details?: Record<string, string[]>;
  };
}

export interface UserDto {
  uuid: string;
  name: string;
  email: string;
  version: number;
  createdAt: string;
}

export interface AuthConfigDto {
  turnstileSiteKey: string | null;
}
