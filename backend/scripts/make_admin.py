"""
Promote a user to admin by email.

Usage (run from the backend directory):
    python scripts/make_admin.py keneth@purplemaia.org

The DATABASE_URL env var must be set (it is on Render automatically).
"""
import os
import sys
import psycopg2

def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/make_admin.py <email>")
        sys.exit(1)

    email = sys.argv[1]
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set.")
        sys.exit(1)

    # asyncpg uses postgresql+asyncpg:// — psycopg2 needs plain postgresql://
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT id, email, is_admin FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if not row:
        print(f"No user found with email: {email}")
        conn.close()
        sys.exit(1)

    user_id, user_email, already_admin = row
    if already_admin:
        print(f"{user_email} (id={user_id}) is already an admin.")
        conn.close()
        return

    cur.execute("UPDATE users SET is_admin = TRUE WHERE id = %s", (user_id,))
    conn.commit()
    print(f"Success — {user_email} (id={user_id}) is now an admin.")
    conn.close()

if __name__ == "__main__":
    main()
