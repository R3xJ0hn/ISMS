import assert from "node:assert/strict";
import test from "node:test";
import { classStudentPreviewSelection, serializeClassStudentPreviews } from "../lib/classes/student-preview";

test("class-card roster queries bound the selected display profiles and use a stable name and ID order", () => {
  assert.equal(classStudentPreviewSelection.students.take, 4);
  assert.deepEqual(classStudentPreviewSelection.students.orderBy, [
    { student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { studentId: "asc" },
  ]);
  assert.deepEqual(Object.keys(classStudentPreviewSelection.students.select.student.select).sort(), [
    "firstName", "id", "lastName", "middleName", "suffix", "userImage",
  ]);
});

test("class-card profiles serialize only the display name, photo and exact string ID, with at most four thumbnails", () => {
  const students = Array.from({ length: 6 }, (_, index) => ({ student: {
    id: 9007199254740993n + BigInt(index), firstName: "Maria", middleName: index === 0 ? "Clara" : null,
    lastName: "Santos", suffix: index === 0 ? "Jr." : null,
    userImage: index === 0 ? "https://res.cloudinary.com/test/image/upload/photo.jpg" : null,
    email: "private@example.test", studentNumber: "PRIVATE-123", phone: "PRIVATE-CONTACT", grades: "PRIVATE-GRADES",
  } }));
  const before = structuredClone(students);
  const previews = serializeClassStudentPreviews(students);
  assert.equal(previews.length, 4);
  assert.deepEqual(previews[0], {
    id: "9007199254740993", name: "Maria Clara Santos Jr.", imageUrl: "https://res.cloudinary.com/test/image/upload/photo.jpg",
  });
  assert.deepEqual(previews[1], { id: "9007199254740994", name: "Maria Santos", imageUrl: null });
  assert.doesNotMatch(JSON.stringify(previews), /PRIVATE|private@example|email|phone|grades|studentNumber|firstName/);
  assert.deepEqual(students, before);
  assert.deepEqual(serializeClassStudentPreviews([]), []);
});
