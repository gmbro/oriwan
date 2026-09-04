export const HELLO_2027_COMMENT_BODY_MAX_LENGTH = 150;
export const HELLO_2027_COMMENT_AUTHOR_MAX_LENGTH = 40;
export const HELLO_2027_COMMENT_MAX_REPLIES = 50;
export const HELLO_2027_COMMENT_PUBLIC_THREAD_LIMIT = 100;
export const HELLO_2027_COMMENT_LIST_LIMIT = 500;

export const HELLO_2027_COMMENT_EMOJIS = ["👍", "❤️", "👏", "🌱", "🏃"] as const;

export type Hello2027CommentEmoji = (typeof HELLO_2027_COMMENT_EMOJIS)[number];
export type Hello2027CommentAuthorMode = "random" | "kakao";
export type Hello2027CommentStatus = "visible" | "hidden" | "deleted";
