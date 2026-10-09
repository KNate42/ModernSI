"""
Creates MongoDB's root user in the low-memory mode (compose.small.yml), instead of the mongo image's own first start.
The image makes that user with mongosh, a Node program of about 150 MB that runs next to mongod; on a 1 GB server
that one-off peak needed a cap of 270 MB for MongoDB alone. This script runs in the API image (pymongo is there)
inside mongo's network namespace, so 127.0.0.1 is MongoDB itself and MongoDB's localhost exception lets it create
the first user of a server started with --auth. Once any user exists the exception is closed, so on later starts
it only checks that the password in .env opens the volume.
This work made by Anfinogentov Nikita
"""
import os
import sys
import time

from pymongo import MongoClient
from pymongo.errors import OperationFailure, PyMongoError

user = os.environ["MONGO_USER"]
password = os.environ["MONGO_PASSWORD"]
address = "mongodb://127.0.0.1:27017/?directConnection=true"
unauthorized = 13
already_exists = 51003


def wait_for_mongo():
    """mongo is already healthy when this starts; the loop only covers a slow restart."""
    for _ in range(60):
        try:
            with MongoClient(address, serverSelectionTimeoutMS=2000) as client:
                client.admin.command("ping")
                return
        except PyMongoError:
            time.sleep(1)
    sys.exit("Ooops.. MongoDB did not answer on 127.0.0.1:27017 within a minute")


def main():
    wait_for_mongo()
    with MongoClient(address, serverSelectionTimeoutMS=5000) as client:
        try:
            client.admin.command("createUser", user, pwd=password, roles=[{"role": "root", "db": "admin"}])
            print(f"mongo: created the root user {user}")
            return
        except OperationFailure as error:
            if error.code not in (unauthorized, already_exists):
                raise
    # a user exists already: the password from .env must open it, or the API could never connect
    try:
        with MongoClient(address, username=user, password=password, authSource="admin", serverSelectionTimeoutMS=5000) as client:
            client.admin.command("ping")
    except OperationFailure:
        sys.exit("Ooops.. MongoDB has users already, and MONGO_PASSWORD in .env does not open it (was .env remade?)")
    print(f"mongo: the root user {user} is there")


main()
