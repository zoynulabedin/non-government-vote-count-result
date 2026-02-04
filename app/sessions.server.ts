import { createCookieSessionStorage } from "react-router";

// In a real app, the secret should be in an environment variable
const sessionSecret = process.env.SESSION_SECRET || "default-secret-key-change-me";

export const storage = createCookieSessionStorage({
  cookie: {
    name: "vote_tracker_session",
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

export const { getSession, commitSession, destroySession } = storage;
