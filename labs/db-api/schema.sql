-- The tasks table. The integration suite applies this file verbatim before
-- running, so it must stay a single idempotent statement. The UNIQUE
-- constraint on title is what turns a duplicate insert into SQLSTATE 23505,
-- which the repository maps to api.ErrDuplicate and the handlers map to 409.
CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL UNIQUE,
    done BOOLEAN NOT NULL DEFAULT FALSE
);
