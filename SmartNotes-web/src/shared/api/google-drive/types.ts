import type { MediaDescriptor } from "@/entities/note";

export type GoogleDriveUploadResult = MediaDescriptor;

export type GoogleDriveTokenState = {
  accessToken: string;
  expiresAt: string;
  degraded: boolean;
};
