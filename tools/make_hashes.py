"""Make the salt and the two word hashes for the seal service.

    python tools/make_hashes.py

Each of you types your own secret word (it is not shown on screen). The script
prints SEAL_SALT, HASH_RUSLAN and HASH_WONDER — paste them into the function's
environment variables. The words themselves are never saved anywhere.
Case and extra spaces don't matter: "Rose Garden " equals "rose garden".
"""

import getpass
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from index import word_hash  # noqa: E402


def ask(who):
    while True:
        first = getpass.getpass("Secret word for %s: " % who)
        if len(" ".join(first.split())) < 6:
            print("  Too short — use at least 6 characters, a short phrase is best.")
            continue
        if getpass.getpass("Again, to be sure: ") != first:
            print("  The two didn't match, try again.")
            continue
        return first


def main():
    salt = os.urandom(16).hex()
    ruslan = ask("Ruslan")
    print()
    wonder = ask("8th Wonder")
    print("\nEnvironment variables for the function:\n")
    print("SEAL_SALT=" + salt)
    print("HASH_RUSLAN=" + word_hash(salt, ruslan))
    print("HASH_WONDER=" + word_hash(salt, wonder))


if __name__ == "__main__":
    main()
