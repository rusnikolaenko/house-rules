"""Make the hash of one person's secret word, without revealing it to anyone else.

    python tools/make_hash.py <salt>

Both of you first agree on one SEAL_SALT (it's not secret, just needs to be the
same for both — anyone can generate it, e.g. with make_hashes.py or
`python -c "import os; print(os.urandom(16).hex())"`). Then each of you runs
this script separately, on your own device, with that salt, and types only
your own word (hidden, not shown on screen). The script prints just your hash
— share that (not the word) with whoever sets up the function's environment
variables.
"""

import getpass
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from index import word_hash  # noqa: E402


def main():
    if len(sys.argv) != 2:
        print("Usage: python tools/make_hash.py <SEAL_SALT>")
        raise SystemExit(1)
    salt = sys.argv[1]

    while True:
        first = getpass.getpass("Your secret word: ")
        if len(" ".join(first.split())) < 6:
            print("  Too short — use at least 6 characters, a short phrase is best.")
            continue
        if getpass.getpass("Again, to be sure: ") != first:
            print("  The two didn't match, try again.")
            continue
        break

    print("\nYour hash (share this, not the word):\n")
    print(word_hash(salt, first))


if __name__ == "__main__":
    main()
