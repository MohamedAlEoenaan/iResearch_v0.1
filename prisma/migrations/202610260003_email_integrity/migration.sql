-- Accounts remain unique even when provisioned by an operator with mixed casing.
CREATE UNIQUE INDEX "User_email_case_insensitive" ON "User" (lower(email));
