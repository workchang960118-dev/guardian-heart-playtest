import type { RoomServiceErrorCode } from "./errors";

export type ApiErrorResponse = {
  ok: false;
  error: {
    code: RoomServiceErrorCode | string;
    message: string;
  };
};

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
