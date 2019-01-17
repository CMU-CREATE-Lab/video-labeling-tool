# Generate a private key with 256 bits
import sys, secrets
argv = sys.argv
if len(argv) > 1:
    if argv[1] == "confirm":
        with open("../data/private_key", "w") as f:
            print("A new key is generated.")
            print(secrets.token_urlsafe(32), file=f)
    else:
        print("Must confirm by running: python gen_key.py confirm")
else:
    print("Must confirm by running: python gen_key.py confirm")
