export type Hello2027Rate = {
  key: "weekly" | "monthly";
  label: string;
  value: number;
};

export type Hello2027Ad = {
  id: string;
  ownerName: string;
  title: string;
  description: string;
  alt: string;
  imageSrc: string;
  mobileFocus?: "left" | "center" | "right";
};

export type Hello2027Reaction = {
  emoji: "👍" | "❤️" | "👏" | "🌱" | "🏃";
  count: number;
  reacted: boolean;
};

export type Hello2027ProfileIntroduction = {
  title: string;
  body: string;
};

export type Hello2027GuestbookReply = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  reactions: readonly Hello2027Reaction[];
};

export type Hello2027GuestbookThread = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  reactions: readonly Hello2027Reaction[];
  replies: readonly Hello2027GuestbookReply[];
};

export type Hello2027Participant = {
  id: string;
  fullName: string;
  pictogramIndex: number;
  completed: boolean;
  seasonCompletionRate: number;
  distanceKm: number | null;
  durationMinutes: number | null;
  product: {
    name: string;
    description: string;
  };
};

export type Hello2027Snapshot = {
  seasonName: string;
  versionName: string;
  referenceDateIso?: string;
  referenceDateLabel: string;
  referenceDateShort: string;
  dayNumber: number;
  totalDays: number;
  daysUntil2027: number;
  completedToday: number;
  participantCount: number;
  rates: readonly Hello2027Rate[];
  ads: readonly Hello2027Ad[];
  encouragements: readonly string[];
  guestbook: readonly Hello2027GuestbookThread[];
  participants: readonly Hello2027Participant[];
};
