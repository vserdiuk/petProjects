import { describe, expect, it } from "vitest";
import { dominantSize, findIssues, formatBytes, median, moveItem, naturalCompare } from "./analyze";

const item = (id: string, width: number, height: number, mime = "image/png", size = 100_000) => ({ id, width, height, mime, size });

describe("dominantSize", () => {
  it("returns the most common size", () => {
    expect(dominantSize([item("a", 10, 20), item("b", 30, 40), item("c", 30, 40)])).toEqual({ width: 30, height: 40 });
  });
  it("breaks ties by first appearance", () => {
    expect(dominantSize([item("a", 10, 20), item("b", 30, 40)])).toEqual({ width: 10, height: 20 });
  });
  it("is null for an empty list", () => {
    expect(dominantSize([])).toBeNull();
  });
});

describe("findIssues", () => {
  it("flags non-PNG files", () => {
    const issues = findIssues([item("a", 1, 1, "image/jpeg")], { width: 1, height: 1 });
    expect(issues.get("a")).toEqual([{ kind: "format", label: "JPG" }]);
  });
  it("flags pictures that differ from the target size and tells if proportions match", () => {
    const issues = findIssues([item("a", 100, 150), item("b", 200, 300), item("c", 100, 100)], { width: 100, height: 150 });
    expect(issues.get("a")).toEqual([]);
    expect(issues.get("b")).toEqual([{ kind: "size", expected: { width: 100, height: 150 }, sameRatio: true }]);
    expect(issues.get("c")).toEqual([{ kind: "size", expected: { width: 100, height: 150 }, sameRatio: false }]);
  });
  it("flags files much heavier than the rest", () => {
    const list = [item("a", 1, 1), item("b", 1, 1), item("c", 1, 1, "image/png", 2_000_000)];
    expect(findIssues(list, null).get("c")).toEqual([{ kind: "heavy", times: 20 }]);
    expect(findIssues(list, null).get("a")).toEqual([]);
  });
  it("does not flag small absolute differences", () => {
    const list = [item("a", 1, 1, "image/png", 1000), item("b", 1, 1, "image/png", 1000), item("c", 1, 1, "image/png", 9000)];
    expect(findIssues(list, null).get("c")).toEqual([]);
  });
});

describe("helpers", () => {
  it("sorts names naturally", () => {
    expect(["p10.png", "p2.png", "p1.png"].sort(naturalCompare)).toEqual(["p1.png", "p2.png", "p10.png"]);
  });
  it("computes the median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
  it("moves items", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 0, 5)).toEqual([1, 2, 3]);
  });
});
