export type AccessRole = "owner" | "editor" | "viewer";
export type InviteStatus = "pending" | "accepted" | "rejected";

export type User = {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  accessToken?: string;
  hasGoogleLinked?: boolean;
  hasPassword?: boolean;
  createdAt?: string;
  lastSignInAt?: string;
  username?: string | null;
  usernameChanged?: boolean;
};
