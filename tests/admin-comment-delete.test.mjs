import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { hardDeleteAdminHello2027Comment } from "../lib/admin-comment-delete.ts";
import {
  filterAdminCommentsAfterHardDelete,
  removeAdminCommentFromView,
} from "../lib/admin-comment-view.ts";

function makeService(result) {
  const operations = [];
  const query = {
    delete() {
      operations.push(["delete"]);
      return this;
    },
    eq(column, value) {
      operations.push(["eq", column, value]);
      return this;
    },
    select(columns) {
      operations.push(["select", columns]);
      return this;
    },
    async maybeSingle() {
      operations.push(["maybeSingle"]);
      return result;
    },
  };
  const service = {
    from(table) {
      operations.push(["from", table]);
      return query;
    },
  };
  return { service, operations };
}

test("어드민 댓글 삭제는 댓글 행 하나를 필터링한 단일 DELETE 문으로 수행한다", async () => {
  const deleted = { id: "comment-id", parent_id: null };
  const { service, operations } = makeService({ data: deleted, error: null });

  const result = await hardDeleteAdminHello2027Comment(service, "comment-id", "4th");

  assert.deepEqual(result, { data: deleted, error: null });
  assert.deepEqual(operations, [
    ["from", "hello_2027_comments"],
    ["delete"],
    ["eq", "id", "comment-id"],
    ["eq", "season_key", "4th"],
    ["select", "id, parent_id"],
    ["maybeSingle"],
  ]);
});

test("DB 스키마는 원댓글→답글과 댓글→반응을 모두 연쇄 삭제한다", async () => {
  const schema = await readFile(new URL("../docs/supabase-schema.sql", import.meta.url), "utf8");

  assert.match(
    schema,
    /parent_id UUID REFERENCES hello_2027_comments\(id\) ON DELETE CASCADE/,
  );
  assert.match(
    schema,
    /comment_id UUID REFERENCES hello_2027_comments\(id\) ON DELETE CASCADE NOT NULL/,
  );
});

const commentRows = [
  { id: "thread-a", parent_id: null, status: "visible" },
  { id: "reply-a-1", parent_id: "thread-a", status: "visible" },
  { id: "reply-a-2", parent_id: "thread-a", status: "hidden" },
  { id: "thread-b", parent_id: null, status: "visible" },
];

test("원댓글을 낙관적으로 삭제하면 연결된 답글도 관리자 목록에서 즉시 제거한다", () => {
  const next = removeAdminCommentFromView(commentRows, "thread-a");

  assert.deepEqual(next.map((comment) => comment.id), ["thread-b"]);
});

test("답글을 낙관적으로 삭제하면 원댓글과 다른 답글은 유지한다", () => {
  const next = removeAdminCommentFromView(commentRows, "reply-a-1");

  assert.deepEqual(next.map((comment) => comment.id), ["thread-a", "reply-a-2", "thread-b"]);
});

test("늦게 도착한 GET도 삭제된 스레드나 legacy placeholder를 되살리지 않는다", () => {
  const staleRows = [
    ...commentRows,
    { id: "legacy-deleted", parent_id: null, status: "deleted" },
  ];
  const next = filterAdminCommentsAfterHardDelete(
    staleRows,
    new Set(["thread-a"]),
    new Set(["thread-a"]),
  );

  assert.deepEqual(next.map((comment) => comment.id), ["thread-b"]);
});
