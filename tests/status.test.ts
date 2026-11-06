import { describe, expect, it } from "vitest";
import { applyStatusChange, columnFor, startOfDay, type StatusStamps } from "@/lib/status";

const now = new Date(2026, 10, 5, 14, 30);
const base: StatusStamps = { status: "WISHLIST", dateApplied: null, leftAppliedAt: null, firstInterviewAt: null };

describe("applyStatusChange", () => {
  it("returns null when the status does not change", () => {
    expect(applyStatusChange({ ...base, status: "APPLIED" }, "APPLIED", now)).toBeNull();
  });

  it("always records the status change time", () => {
    const patch = applyStatusChange(base, "APPLIED", now);
    expect(patch).toMatchObject({ status: "APPLIED", statusChangedAt: now });
  });

  it("sets leftAppliedAt and firstInterviewAt when leaving Applied for Interviewing", () => {
    const patch = applyStatusChange({ ...base, status: "APPLIED", dateApplied: startOfDay(now) }, "INTERVIEWING", now);
    expect(patch?.leftAppliedAt).toEqual(now);
    expect(patch?.firstInterviewAt).toEqual(now);
  });

  it("does not reset leftAppliedAt when a job moves back to Applied and on again", () => {
    const firstExit = new Date(2026, 9, 1);
    const job: StatusStamps = { status: "INTERVIEWING", dateApplied: new Date(2026, 8, 20), leftAppliedAt: firstExit, firstInterviewAt: firstExit };
    const back = applyStatusChange(job, "APPLIED", now);
    expect(back?.leftAppliedAt).toBeUndefined();
    const onward = applyStatusChange({ ...job, status: "APPLIED" }, "REJECTED", now);
    expect(onward?.leftAppliedAt).toBeUndefined(); // stored value (2026-10-01) is kept
  });

  it("does not overwrite firstInterviewAt on a second interview stage", () => {
    const first = new Date(2026, 9, 3);
    const patch = applyStatusChange({ ...base, status: "OFFER", dateApplied: first, firstInterviewAt: first }, "INTERVIEWING", now);
    expect(patch?.firstInterviewAt).toBeUndefined();
  });

  it("does not set leftAppliedAt when the job was never in Applied", () => {
    const patch = applyStatusChange(base, "INTERVIEWING", now);
    expect(patch?.leftAppliedAt).toBeUndefined();
    expect(patch?.firstInterviewAt).toEqual(now);
  });
});

describe("Date Applied auto-fill", () => {
  it("sets Date Applied to today when a dateless job moves to Applied", () => {
    expect(applyStatusChange(base, "APPLIED", now)?.dateApplied).toEqual(new Date(2026, 10, 5));
  });

  it("sets Date Applied when a dateless job skips straight to a later stage", () => {
    expect(applyStatusChange(base, "OFFER", now)?.dateApplied).toEqual(new Date(2026, 10, 5));
  });

  it("keeps an existing Date Applied", () => {
    const patch = applyStatusChange({ ...base, dateApplied: new Date(2026, 8, 15) }, "APPLIED", now);
    expect(patch?.dateApplied).toBeUndefined();
  });

  it("does not set Date Applied when moving back to Wishlist", () => {
    expect(applyStatusChange({ ...base, status: "APPLIED" }, "WISHLIST", now)?.dateApplied).toBeUndefined();
  });
});

describe("columnFor", () => {
  it("groups Offer and Rejected into the closed column", () => {
    expect(columnFor("OFFER")).toBe("closed");
    expect(columnFor("REJECTED")).toBe("closed");
    expect(columnFor("APPLIED")).toBe("applied");
  });
});
