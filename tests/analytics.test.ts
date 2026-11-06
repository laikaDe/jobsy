import { describe, expect, it } from "vitest";
import {
  applicationToInterviewRate,
  averageDaysInApplied,
  computeDashboard,
  daysBetween,
  formatDays,
  formatRate,
  isGhosted,
  type JobFacts,
} from "@/lib/analytics";
import type { Status } from "@/lib/status";

const NOW = new Date("2026-11-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function job(status: Status, o: Partial<JobFacts> = {}): JobFacts {
  return {
    status,
    dateApplied: status === "WISHLIST" ? null : daysAgo(20),
    statusChangedAt: daysAgo(1),
    leftAppliedAt: null,
    firstInterviewAt: null,
    ...o,
  };
}

describe("dashboard tiles", () => {
  it("empty database → all zeros and null analytics", () => {
    expect(computeDashboard([], NOW)).toEqual({
      totalApplied: 0,
      activeInterviews: 0,
      ghostedOrRejected: 0,
      conversionRate: null,
      avgDaysInApplied: null,
    });
  });

  it("Total Applied counts every job with a Date Applied, rejected included → 5", () => {
    const jobs = [
      job("WISHLIST"), job("WISHLIST"),
      job("APPLIED"), job("APPLIED"), job("APPLIED"),
      job("INTERVIEWING"), job("REJECTED"),
    ];
    expect(computeDashboard(jobs, NOW).totalApplied).toBe(5);
  });

  it("Active Interviews counts only current INTERVIEWING → 2", () => {
    const jobs = [job("INTERVIEWING"), job("INTERVIEWING"), job("OFFER", { firstInterviewAt: daysAgo(5) })];
    expect(computeDashboard(jobs, NOW).activeInterviews).toBe(2);
  });

  it("Ghosted / Rejected = rejected + ghosted → 3", () => {
    const jobs = [job("REJECTED"), job("REJECTED"), job("APPLIED", { statusChangedAt: daysAgo(40) }), job("APPLIED")];
    expect(computeDashboard(jobs, NOW).ghostedOrRejected).toBe(3);
  });

  it("honours a custom ghost threshold", () => {
    const jobs = [job("APPLIED", { statusChangedAt: daysAgo(10) })];
    expect(computeDashboard(jobs, NOW, 7).ghostedOrRejected).toBe(1);
    expect(computeDashboard(jobs, NOW, 30).ghostedOrRejected).toBe(0);
  });
});

describe("isGhosted", () => {
  it("APPLIED unchanged for 31 days is ghosted", () => {
    expect(isGhosted(job("APPLIED", { statusChangedAt: daysAgo(31) }), NOW)).toBe(true);
  });
  it("APPLIED changed 10 days ago is not ghosted", () => {
    expect(isGhosted(job("APPLIED", { statusChangedAt: daysAgo(10) }), NOW)).toBe(false);
  });
  it("exactly at the threshold counts as ghosted", () => {
    expect(isGhosted(job("APPLIED", { statusChangedAt: daysAgo(30) }), NOW)).toBe(true);
  });
  it("only APPLIED jobs can be ghosted", () => {
    expect(isGhosted(job("INTERVIEWING", { statusChangedAt: daysAgo(90) }), NOW)).toBe(false);
  });
});

describe("applicationToInterviewRate", () => {
  it("includes jobs that interviewed and later got an offer or rejection → 30.0%", () => {
    const jobs = [
      job("INTERVIEWING", { firstInterviewAt: daysAgo(3) }),
      job("OFFER", { firstInterviewAt: daysAgo(9) }),
      job("REJECTED", { firstInterviewAt: daysAgo(6) }),
      ...Array.from({ length: 7 }, () => job("APPLIED")),
      job("WISHLIST"), // not applied: excluded from the denominator
    ];
    expect(applicationToInterviewRate(jobs)).toBe(30);
    expect(formatRate(applicationToInterviewRate(jobs))).toBe("30.0%");
  });

  it("no applications → null, shown as —", () => {
    expect(applicationToInterviewRate([job("WISHLIST")])).toBeNull();
    expect(formatRate(null)).toBe("—");
  });
});

describe("averageDaysInApplied", () => {
  it("mean of completed Applied stages, excluding jobs still in Applied → 7.0", () => {
    const left = (days: number) => job("INTERVIEWING", { dateApplied: daysAgo(30), leftAppliedAt: daysAgo(30 - days) });
    const jobs = [left(4), left(10), left(7), job("APPLIED")];
    expect(averageDaysInApplied(jobs)).toBe(7);
    expect(formatDays(averageDaysInApplied(jobs))).toBe("7.0");
  });

  it("nothing has left Applied → null, shown as —", () => {
    expect(averageDaysInApplied([job("APPLIED"), job("APPLIED")])).toBeNull();
    expect(formatDays(null)).toBe("—");
  });

  it("clamps a Date Applied later than the exit to 0 days", () => {
    const j = job("INTERVIEWING", { dateApplied: daysAgo(2), leftAppliedAt: daysAgo(5) });
    expect(averageDaysInApplied([j])).toBe(0);
  });
});

describe("daysBetween", () => {
  it("never returns a negative number", () => {
    expect(daysBetween(NOW, daysAgo(3))).toBe(0);
    expect(daysBetween(daysAgo(3), NOW)).toBe(3);
  });
});
