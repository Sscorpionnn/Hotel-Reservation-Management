import { ConflictException } from "@nestjs/common";
import { assertTransitionAllowed, RESERVATION_TRANSITIONS } from "./reservation-state-machine";

describe("assertTransitionAllowed", () => {
  it("allows every transition declared in the table", () => {
    for (const [from, targets] of Object.entries(RESERVATION_TRANSITIONS)) {
      for (const to of targets) {
        expect(() =>
          assertTransitionAllowed(from as keyof typeof RESERVATION_TRANSITIONS, to),
        ).not.toThrow();
      }
    }
  });

  it("rejects every transition not declared in the table", () => {
    const allStates = Object.keys(RESERVATION_TRANSITIONS) as Array<
      keyof typeof RESERVATION_TRANSITIONS
    >;
    for (const from of allStates) {
      for (const to of allStates) {
        if (RESERVATION_TRANSITIONS[from].includes(to)) continue;
        expect(() => assertTransitionAllowed(from, to)).toThrow(ConflictException);
      }
    }
  });

  it("treats every terminal state as a dead end", () => {
    for (const terminal of ["CHECKED_OUT", "CANCELLED", "EXPIRED"] as const) {
      expect(RESERVATION_TRANSITIONS[terminal]).toHaveLength(0);
    }
  });
});
