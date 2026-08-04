ALTER TABLE users
  ADD COLUMN counts_as_employee TINYINT(1) NULL AFTER employment_status;

CREATE INDEX idx_users_company_active_employee
  ON users (company_id, is_active, employment_status, counts_as_employee, role);

ALTER TABLE users
  ADD COLUMN employee_registration VARCHAR(120) NULL AFTER position;

CREATE INDEX idx_users_company_registration
  ON users (company_id, employee_registration);

ALTER TABLE email_logs
  MODIFY COLUMN type ENUM('reminder_employee','alert_rh','welcome','cipa_pending_vote') NOT NULL;
