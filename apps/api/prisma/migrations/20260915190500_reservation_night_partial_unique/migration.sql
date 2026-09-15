-- This is the single hard guarantee against double-booking: at most one
-- *active* (not released) ReservationNight per (room, calendar night).
-- Prisma's schema language has no syntax for a partial/filtered index, so
-- it is created here by hand. Two concurrent transactions racing to book
-- the same room for the same night will have one succeed and one fail
-- this constraint with a 23505 unique_violation — Postgres enforces this
-- at the index level regardless of transaction isolation, so no explicit
-- row locking is required for correctness.
CREATE UNIQUE INDEX "reservation_nights_room_stay_active_unique"
  ON "reservation_nights" ("roomId", "stayDate")
  WHERE "releasedAt" IS NULL;

-- Every non-trivial availability/occupancy query filters on these two
-- columns together; keep it indexed for reads too (the unique index above
-- only covers the WHERE released_at IS NULL subset).
CREATE INDEX "reservation_nights_stay_date_released_idx"
  ON "reservation_nights" ("stayDate", "releasedAt");
