"""
Profile logic. Base fields come from Postgres, the rest from the MongoDB "profiles" collection,
avatars from the GridFS bucket "avatars".
This work made by Anfinogentov Nikita
"""
from gridfs import AsyncGridFSBucket
from gridfs.errors import NoFile
from pymongo.errors import PyMongoError

from modernsi.core.db import utcnow
from modernsi.core.errors import api_error

max_avatar = 2 * 1024 * 1024


def sniff_image(head):
    # I trust the bytes, not the file name or the browser's content type
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def avatars(hub):
    return AsyncGridFSBucket(hub.mongo, bucket_name="avatars")


async def get_profile(hub, user):
    profile = {
        "id": user.id, "display_name": user.display_name, "campus_label": user.campus_label,
        "role": user.role, "joined_at": user.created_at,
    }
    try:
        doc = await hub.mongo["profiles"].find_one({"_id": str(user.id)}) or {}
    except PyMongoError:
        profile["extended"] = False
        return profile
    profile.update(
        bio=doc.get("bio", ""), languages=doc.get("languages", []), interests=doc.get("interests", []),
        links=doc.get("links", []), theme=doc.get("theme", "system"), has_avatar=bool(doc.get("avatar_id")), extended=True,
    )
    return profile


async def update_profile(hub, user, data):
    fields = {
        "bio": data.bio, "languages": data.languages, "interests": data.interests,
        "links": [str(link) for link in data.links], "theme": data.theme, "updated_at": utcnow(),
    }
    await hub.mongo["profiles"].update_one({"_id": str(user.id)}, {"$set": fields}, upsert=True)
    return await get_profile(hub, user)


async def set_avatar(hub, user, content):
    if len(content) > max_avatar:
        raise api_error(413, "avatar_too_large", "The picture must be 2 MB or smaller")
    kind = sniff_image(content[:16])
    if kind is None:
        raise api_error(422, "avatar_bad_type", "Use a PNG, JPEG or WebP picture")
    bucket = avatars(hub)
    new_id = await bucket.upload_from_stream(str(user.id), content, metadata={"user_id": str(user.id), "content_type": kind})
    old = await hub.mongo["profiles"].find_one_and_update({"_id": str(user.id)}, {"$set": {"avatar_id": new_id}}, upsert=True)
    if old and old.get("avatar_id"):
        try:
            await bucket.delete(old["avatar_id"])
        except NoFile:
            pass


async def get_avatar(hub, user_id):
    doc = await hub.mongo["profiles"].find_one({"_id": str(user_id)})
    if not doc or not doc.get("avatar_id"):
        raise api_error(404, "no_avatar", "This user has no picture")
    stream = await avatars(hub).open_download_stream(doc["avatar_id"])
    return await stream.read(), stream.metadata["content_type"]
