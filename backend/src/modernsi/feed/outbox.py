"""
emit(): the only way modules put something into the activity feed.
This work made by Anfinogentov Nikita
"""
from modernsi.feed.models import Outbox

kinds = {"user_verified", "idea_created", "idea_reached_review", "idea_decided", "team_formed", "event_published"}


def emit(db, kind, actor_id=None, idea_id=None, event_id=None, campus_label=None, data=None):
    # I only add the row; the caller commits it together with the action itself
    if kind not in kinds:
        raise ValueError("unknown feed kind: " + kind)
    db.add(Outbox(kind=kind, actor_id=actor_id, idea_id=idea_id, event_id=event_id, campus_label=campus_label, data=data or {}))
