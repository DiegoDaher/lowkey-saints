-- Coordinate with the API/UI rollout: existing profiles keep their identity and activity.
ALTER TYPE "Role" RENAME VALUE 'STAFF' TO 'OPERATOR';
-- RLS remains backend-only. End-user permissions are enforced by the Edge API.
