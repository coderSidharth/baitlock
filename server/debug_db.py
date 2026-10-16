import sqlite3
import os

for dbfile in ['events.db', 'baitlock.db']:
    path = os.path.join(os.getcwd(), dbfile)
    if os.path.exists(path):
        print(f"\n=== {dbfile} (size: {os.path.getsize(path)} bytes) ===")
        conn = sqlite3.connect(path)
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = c.fetchall()
        print(f"Tables: {[t[0] for t in tables]}")
        for table in tables:
            c.execute(f"SELECT COUNT(*) FROM {table[0]}")
            count = c.fetchone()[0]
            print(f"  {table[0]}: {count} rows")
        conn.close()
    else:
        print(f"\n{dbfile}: NOT FOUND")
