"""
Password hashing with argon2id.
This work made by Anfinogentov Nikita
"""
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

hasher = PasswordHasher()


def hash_password(password):
    return hasher.hash(password)


def verify_password(stored_hash, password):
    try:
        return hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
