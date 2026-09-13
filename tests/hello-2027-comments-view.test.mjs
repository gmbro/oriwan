import assert from "node:assert/strict";
import test from "node:test";

import {
  isHello2027PublicThreadStatus,
  removeHello2027CommentFromView,
  updateHello2027CommentInView,
} from "../lib/hello-2027-comments-view.ts";

const makeReaction = () => ({ emoji: "👍", count: 1, reacted: false });

const threads = [{
  id: "thread-1",
  author: "작성자",
  body: "원댓글",
  createdAt: "2026-09-07T00:00:00.000Z",
  ownedByViewer: true,
  reactions: [makeReaction()],
  replies: [{
    id: "reply-1",
    author: "답글 작성자",
    body: "답글",
    createdAt: "2026-09-07T00:01:00.000Z",
    ownedByViewer: false,
    reactions: [],
  }],
}, {
  id: "thread-2",
  author: "다른 작성자",
  body: "남아야 하는 댓글",
  createdAt: "2026-09-07T00:02:00.000Z",
  ownedByViewer: false,
  reactions: [],
  replies: [],
}];

test("원댓글을 삭제하면 답글 유무와 관계없이 공개 목록에서 전체 스레드를 제거한다", () => {
  const next = removeHello2027CommentFromView(threads, "thread-1");

  assert.deepEqual(next.map((thread) => thread.id), ["thread-2"]);
  assert.equal(JSON.stringify(next).includes("삭제된 댓글입니다."), false);
});

test("답글 삭제는 원댓글을 유지하고 해당 답글만 제거한다", () => {
  const next = removeHello2027CommentFromView(threads, "reply-1");

  assert.equal(next.length, 2);
  assert.deepEqual(next[0].replies, []);
  assert.equal(next[0].body, "원댓글");
});

test("공개 목록에는 visible 상태의 원댓글만 포함한다", () => {
  assert.equal(isHello2027PublicThreadStatus("visible"), true);
  assert.equal(isHello2027PublicThreadStatus("deleted"), false);
  assert.equal(isHello2027PublicThreadStatus("hidden"), false);
  assert.equal(isHello2027PublicThreadStatus(undefined), false);
});

test("댓글 수정 응답은 본문·수정 시각만 바꾸고 답글·반응·작성일을 보존한다", () => {
  const updatedAt = "2026-09-08T01:00:00.000Z";
  const next = updateHello2027CommentInView(threads, { id: "thread-1", body: "수정한 댓글", updatedAt });
  assert.equal(next[0].body, "수정한 댓글");
  assert.equal(next[0].updatedAt, updatedAt);
  assert.deepEqual(next[0].replies, threads[0].replies);
  assert.deepEqual(next[0].reactions, threads[0].reactions);
  assert.equal(next[0].createdAt, threads[0].createdAt);
  assert.deepEqual(next[1], threads[1]);
});

test("답글 수정은 같은 작성자의 원댓글·다른 답글까지 덮어쓰지 않는다", () => {
  const next = updateHello2027CommentInView(threads, { id: "reply-1", body: "수정한 답글", updatedAt: "2026-09-08T01:00:00.000Z" });
  assert.equal(next[0].replies[0].body, "수정한 답글");
  assert.equal(next[0].body, threads[0].body);
  assert.equal(next[0].replies[0].ownedByViewer, false);
  assert.equal(threads[0].replies[0].body, "답글");
});
