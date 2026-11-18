import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adminPermission,
  hasPermission,
} from "../supabase/functions/_shared/admin-access.ts";

const routes = [
  ["GET", "/me", true],
  ["GET", "/health", false],
  ["GET", "/products", true],
  ["GET", "/products/id", true],
  ["POST", "/products", false],
  ["PUT", "/products/id", false],
  ["PATCH", "/products/id", false],
  ["POST", "/variants", false],
  ["PATCH", "/variants/id", false],
  ["PATCH", "/stock", true],
  ["GET", "/orders", true],
  ["GET", "/orders/id/history", true],
  ["PATCH", "/orders/id", true],
  ["GET", "/restock", false],
  ["POST", "/restock/retry", false],
  ["GET", "/finances", false],
  ["PUT", "/finances", false],
  ["GET", "/roles", false],
  ["PUT", "/roles", false],
  ["POST", "/images", false],
  ["DELETE", "/images/id", false],
] as const;
test("all administrative operations have explicit role permissions", () => {
  for (const [method, path, operator] of routes) {
    const permission = adminPermission("/v1/admin" + path, method);
    assert.ok(permission, path);
    assert.equal(hasPermission("ADMIN", permission), true, path);
    assert.equal(hasPermission("OPERATOR", permission), operator, path);
    for (const role of ["STAFF", "authenticated", "", "admin"])
      assert.equal(hasPermission(role, permission), false);
  }
});
test("unknown methods, routes and nested paths fail closed", () => {
  for (const path of [
    "/finances/extra",
    "/images/id",
    "/new-feature",
    "/products/id/extra",
    "/orders/id",
  ])
    assert.equal(adminPermission("/v1/admin" + path, "GET"), null);
  assert.equal(adminPermission("/v1/admin/stock", "POST"), null);
  assert.equal(adminPermission("/v1/admin/products", "DELETE"), null);
});
