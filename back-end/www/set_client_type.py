import sys
from application import update_client_type_by_user_id

def main(argv):
    if len(argv) > 2:
        user = update_client_type_by_user_id(user_id=argv[1], client_type=argv[2])
        print("User client type updated.")
    else:
        print("Usage: python set_client_type.py [user_id] [client_type]")

if __name__ == "__main__":
    main(sys.argv)
