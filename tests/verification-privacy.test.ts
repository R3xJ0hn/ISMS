import assert from "node:assert/strict";
import test from "node:test";
import { filterVerificationAnalytics, isAnalyticsExcludedPath, isVerificationPath } from "../lib/auth/verification-privacy";

test("verification and student update events do not send bearer URLs to analytics", () => {
  for (const path of ["/verify-email", "/verify-email/", "/forgot-password", "/forgot-password/", "/reset-password", "/reset-password/", "/teacher/activate", "/teacher/activate/", "/admission/update", "/admission/update/password"]) {
    assert.equal(isVerificationPath(path), true);
    const event = { type: "pageview", url: "https://example.test" + path + "?token=private-secret" };
    assert.equal(filterVerificationAnalytics(event), null);
    assert.equal(filterVerificationAnalytics({ url: path + "?token=private-secret" }), null);
  }
});

test("ordinary public and portal events retain their URL and event type", () => {
  for (const path of ["/", "/admission", "/portal/my-classes-other", "/portal/classroom-other", "/verify-email-other", "/forgot-password-other", "/reset-password-other", "/teacher/activate-other", "/admission/update-info"]) {
    assert.equal(isVerificationPath(path), false);
    const event = { type: "vital", url: "https://example.test" + path };
    assert.equal(filterVerificationAnalytics(event), event);
  }
});

test("class forms, student rosters, and student classrooms are excluded from analytics without matching sibling routes", () => {
  for (const path of ["/portal/classes", "/portal/classes/new", "/portal/classes/7/edit", "/portal/my-classes", "/portal/my-classes/7", "/portal/classroom", "/portal/classroom/", "/portal/classroom/7"]) {
    assert.equal(isAnalyticsExcludedPath(path), true);
    assert.equal(filterVerificationAnalytics({ url: "https://portal.example.test" + path }), null);
    assert.equal(filterVerificationAnalytics({ url: path + "?tab=grades" }), null);
  }
  for (const path of ["/portal/classes-other", "/portal/my-classes-other", "/portal/classroom-other"]) assert.equal(isAnalyticsExcludedPath(path), false);
});

test("employee records, forms, and own information are excluded from analytics while sibling routes remain eligible", () => {
  for (const path of ["/portal/employees", "/portal/employees/", "/portal/employees/new", "/portal/employees/123/edit", "/portal/teachers", "/portal/teachers/new", "/portal/teachers/123/edit", "/portal/information", "/portal/information/", "/portal/information/other"]) {
    assert.equal(isAnalyticsExcludedPath(path), true);
    assert.equal(filterVerificationAnalytics({ url: "https://portal.example.test" + path }), null);
  }
  assert.equal(isAnalyticsExcludedPath("/portal/employees-other"), false);
  assert.equal(isAnalyticsExcludedPath("/portal/teachers-other"), false);
  assert.equal(isAnalyticsExcludedPath("/portal/information-other"), false);
});

test("user photos and student management pages are excluded from analytics without matching sibling routes", () => {
  for (const path of ["/portal/users", "/portal/users/", "/portal/users/7/edit", "/portal/students", "/portal/students/12", "/portal/students/12/edit", "/portal/last-schools", "/portal/last-schools/new", "/portal/last-schools/7/edit"]) {
    assert.equal(isAnalyticsExcludedPath(path), true);
    assert.equal(filterVerificationAnalytics({ url: "https://portal.example.test" + path }), null);
  }
  for (const path of ["/portal/users-other", "/portal/students-other", "/portal/last-schools-other"]) assert.equal(isAnalyticsExcludedPath(path), false);
});

test("student admission review details are excluded from analytics without matching sibling routes", () => {
  for (const path of ["/portal/admission-review", "/portal/admission-review/", "/portal/admission-review/edit"]) {
    assert.equal(isAnalyticsExcludedPath(path), true);
    assert.equal(filterVerificationAnalytics({ url: "https://portal.example.test" + path }), null);
    assert.equal(filterVerificationAnalytics({ url: path + "?student=private" }), null);
  }
  assert.equal(isAnalyticsExcludedPath("/portal/admission-review-other"), false);
});
