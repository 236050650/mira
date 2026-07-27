export declare const ErrorCodes: {
    readonly AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS";
    readonly AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED";
    readonly AUTH_EMAIL_EXISTS: "AUTH_EMAIL_EXISTS";
    readonly AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly PERSONA_NOT_FOUND: "PERSONA_NOT_FOUND";
    readonly CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND";
    readonly MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND";
    readonly MEMORY_NOT_FOUND: "MEMORY_NOT_FOUND";
    readonly MODEL_PROFILE_INVALID: "MODEL_PROFILE_INVALID";
    readonly MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE";
    readonly MODEL_NOT_INSTALLED: "MODEL_NOT_INSTALLED";
    readonly MODEL_TIMEOUT: "MODEL_TIMEOUT";
    readonly MODEL_RATE_LIMITED: "MODEL_RATE_LIMITED";
    readonly MODEL_BALANCE_INSUFFICIENT: "MODEL_BALANCE_INSUFFICIENT";
    readonly MODEL_BUDGET_EXCEEDED: "MODEL_BUDGET_EXCEEDED";
    readonly GENERATION_INTERRUPTED: "GENERATION_INTERRUPTED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
export type ApiErrorBody = {
    error: {
        code: ErrorCode | string;
        message: string;
        requestId: string;
        details?: unknown;
    };
};
//# sourceMappingURL=errors.d.ts.map