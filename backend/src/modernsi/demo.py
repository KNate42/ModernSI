"""
Demo network for a first look at the site: four campuses on demo.example, accounts with known passwords
for every role, ideas in every state, events this week and in the past, RSVPs, votes and feed entries.
Every person and campus here is made up. The first run creates everything; a later run only moves the
demo events back around today, so the homepage stays alive however long the stack has been down.
disable_demo() closes the demo when a stack goes live: demo accounts are blocked and demo domains switched off.
This work made by Anfinogentov Nikita
"""
import uuid
from datetime import timedelta

from sqlalchemy import select, update

from modernsi.auth.models import User
from modernsi.auth.passwords import hash_password, verify_password
from modernsi.auth.sessions import drop_all_sessions
from modernsi.campuses.models import EmailDomain
from modernsi.campuses.service import add_domain
from modernsi.core.db import utcnow
from modernsi.events.models import Event, EventRsvp
from modernsi.feed.models import Outbox
from modernsi.ideas.models import Idea, IdeaTeamMember, IdeaVote

demo_suffix = ".demo.example"
# There I derive every id from a fixed namespace, so a second run finds the rows of the first one
namespace = uuid.uuid5(uuid.NAMESPACE_DNS, "demo.example")

campuses = [
    ("almaty.demo.example", "Almaty", "KZ"),
    ("astana.demo.example", "Astana", "KZ"),
    ("tashkent.demo.example", "Tashkent", "UZ"),
    ("bishkek.demo.example", "Bishkek", "KG"),
]

# (email, display name, role, bio) of the accounts the README lists
accounts = [
    ("student@almaty.demo.example", "Aliya Demo", "student", "Second-year economics. I pitch ideas and turn up to everything with free tea."),
    ("gov@almaty.demo.example", "Timur Demo", "student_gov", "Student Government, Almaty. I read every idea in the review queue."),
    ("curator@astana.demo.example", "Madina Demo", "curator", "Campus curator in Astana. I put the official events on the calendar."),
    ("admin@almaty.demo.example", "Admin Demo", "admin", "Keeps the demo network running."),
]

first_names = [
    "Aru", "Dana", "Erlan", "Saule", "Nurlan", "Zarina", "Bekzat", "Kamila", "Ruslan", "Asel", "Daniyar", "Malika",
    "Sanjar", "Dilnoza", "Azamat", "Aigerim", "Jasur", "Nilufar", "Bakyt", "Aizada", "Arman", "Gulnara", "Timur", "Laylo",
    "Islam", "Aisha", "Rustam", "Zhanna",
]
initials = ["K.", "S."]

# key, author ("student", "gov" or a member number), title, summary, category, scope, status, votes, team, days ago, note
ideas = [
    ("hike", 4, "Sunrise hike to Big Almaty Lake", "A group hike that starts at 5 am, with a bus from the main gate and breakfast at the lake.", "event", "campus", "open", 41, 0, 9, None),
    ("tutoring", 7, "Peer tutoring for first-year calculus", "Second-years explain limits and integrals to first-years twice a week, in small groups.", "academic", "network", "open", 33, 0, 12, None),
    ("tables", 11, "Language exchange tables every Thursday", "One table per language, swap every 20 minutes. Bring a word you love.", "club", "network", "open", 27, 0, 6, None),
    ("repair", 15, "Repair café for broken laptops and bikes", "Once a month, students who can fix things help those who cannot, for free.", "volunteering", "campus", "open", 18, 0, 15, None),
    ("quiet", 19, "Quiet study room open until midnight", "Keep one room in the library open until midnight during exam weeks.", "campus_life", "campus", "open", 11, 0, 4, None),
    ("podcast", "student", "A podcast about research on our campuses", "Short episodes where students explain their research to friends who are not in their field.", "research", "network", "open", 6, 0, 3, None),
    ("boardgames", 23, "Board game night in the dorm lobby", "Bring a game from home, learn one from somebody else.", "event", "campus", "open", 3, 0, 1, None),
    ("cinema", 26, "Open-air cinema on the main lawn", "Three films chosen by vote, a borrowed projector and blankets on the grass.", "event", "campus", "in_review", 50, 0, 20, None),
    ("firstaid", 30, "Mental health first-aid workshop", "A trained counsellor teaches how to notice a friend in trouble and what to say.", "academic", "network", "in_review", 50, 0, 24, None),
    ("coffee", "student", "A coffee machine in the library", "A coffee machine on the ground floor of the library, paid by card.", "campus_life", "campus", "needs_changes", 50, 0, 30, "Who refills and cleans it? Name a team or a partner café, then send it back."),
    ("noexams", 34, "No exams in December", "Move all December exams to January so the holidays start earlier.", "campus_life", "network", "rejected", 50, 0, 33, "Exam dates are set by the universities, not by students. Try a petition to the dean's office."),
    ("hackathon", "student", "Cross-campus hackathon weekend", "48 hours, mixed teams from every campus, problems brought by local NGOs.", "research", "network", "forming_team", 50, 4, 28, None),
    ("cleanup", 38, "Clean-up day at the river", "Gloves, bags and a picnic afterwards. The city gives the bags.", "volunteering", "campus", "forming_team", 50, 2, 26, None),
    ("cooking", 42, "Cooking masterclass: dishes from home", "Students cook a family recipe and teach it to a group of eight.", "event", "network", "live", 50, 5, 35, None),
    ("careers", 46, "Career talks with alumni", "Graduates tell how they found their first job, then answer questions.", "academic", "network", "live", 50, 4, 38, None),
    ("football", 50, "Football tournament between campuses", "Five-a-side teams from each campus, a final on Saturday.", "club", "network", "live", 50, 6, 40, None),
    ("picnic", 1, "Welcome picnic for exchange students", "Food, frisbee and a map of the city drawn by people who live here.", "event", "network", "done", 50, 5, 45, None),
    ("bookswap", 5, "Spring book swap", "Bring a book you finished, take one you have not read.", "club", "campus", "done", 50, 3, 50, None),
    ("garden", 9, "Rooftop vegetable garden", "Turn the empty roof of the student centre into a garden.", "campus_life", "campus", "expired", 12, 0, 63, None),
]

# key, idea key or None for a curator event, title, days from today, hour (UTC), hours long, place, online link, network-wide
events = [
    ("cooking", "cooking", "Cooking masterclass: dishes from home", 1, 13, 3, "Student centre kitchen, 2nd floor", None, True),
    ("visa", None, "Visa and residence permit Q&A", 2, 10, 2, None, "https://meet.demo.example/visa-qa", True),
    ("careers", "careers", "Career talks with alumni", 3, 12, 2, "Main hall, room 101", None, True),
    ("football", "football", "Football tournament between campuses", 5, 8, 6, "University stadium", None, True),
    ("evening", None, "International evening: food from home", 6, 14, 4, "Student centre, ground floor", None, False),
    ("kickoff", None, "Semester kick-off meetup", 12, 13, 2, "Library courtyard", None, True),
    ("library", None, "Library tour for newcomers", -3, 9, 1, "Main library entrance", None, False),
    ("picnic", "picnic", "Welcome picnic for exchange students", -6, 10, 4, "Central park, by the fountain", None, True),
    ("bookswap", "bookswap", "Spring book swap", -16, 11, 3, "Library foyer", None, False),
]

descriptions = {
    "cooking": "Eight stations, eight recipes from home. Sign up below so we buy enough flour.",
    "visa": "The international office answers questions about visas, registration and permits. Bring your questions, not your documents.",
    "careers": "Five alumni, ten minutes each, then open questions. Snacks after.",
    "football": "Five-a-side, 10-minute halves. Teams register at the stadium at 13:00 local time.",
    "evening": "Bring a dish from home and a story about it. Plates and tea are on us.",
    "kickoff": "Meet Student Government and the curators, hear what is planned for the semester.",
    "library": "A 40-minute walk through the library: where the quiet rooms are and how to book them.",
    "picnic": "Our first picnic of the year for everyone who arrived this semester.",
    "bookswap": "About 200 books changed hands. Thank you to everyone who brought one.",
}


def demo_id(kind, key):
    return uuid.uuid5(namespace, f"{kind}:{key}")


def event_times(now, days, hour, hours):
    starts = now.replace(hour=hour, minute=0, second=0, microsecond=0) + timedelta(days=days)
    return starts, starts + timedelta(hours=hours)


def member_specs():
    # 56 made-up students spread over the four campuses
    people = []
    for index, (first, initial) in enumerate((first, initial) for initial in initials for first in first_names):
        domain = campuses[index % len(campuses)][0]
        email = f"{first.lower()}.{initial[0].lower()}@{domain}"
        people.append((email, f"{first} {initial}", "student", None))
    return people


async def is_seeded(db):
    return await db.get(User, demo_id("user", accounts[-1][0])) is not None


async def seed_demo(hub, settings):
    """Create the demo network once, or refresh its event dates. Returns "created" or "refreshed"."""
    async with hub.sessions() as db:
        domains = {}
        for domain, label, country in campuses:
            domains[domain] = await add_domain(db, domain, label, country)
        if await is_seeded(db):
            await refresh(db, settings)
            await reopen_accounts(db, settings)
            return "refreshed"
        await create(db, settings, domains)
    await write_profiles(hub)
    return "created"


async def create(db, settings, domains):
    now = utcnow()
    password_hash = hash_password(settings.demo_password)
    users = []
    for number, (email, name, role, _bio) in enumerate(accounts + member_specs()):
        joined = now - timedelta(days=55 - number % 30, hours=number)
        user = User(
            id=demo_id("user", email), email=email, password_hash=password_hash, display_name=name, role=role,
            status="active", created_at=joined, verified_at=joined + timedelta(minutes=5),
        )
        user.domain = domains[email.split("@")[1]]
        db.add(user)
        users.append(user)
        feed(db, "user_verified", user.verified_at, actor_id=user.id, campus_label=user.campus_label, data={"display_name": name})
    by_role = {role: users[index] for index, (_email, _name, role, _bio) in enumerate(accounts)}
    gov = by_role["student_gov"]
    members = users[len(accounts):]
    await db.flush()

    idea_rows = {}
    for index, (key, author_ref, title, summary, category, scope, status, votes, team, days_ago, note) in enumerate(ideas):
        author = by_role["student"] if author_ref == "student" else members[author_ref % len(members)]
        created = now - timedelta(days=days_ago, hours=index)
        idea = Idea(
            id=demo_id("idea", key), author_id=author.id, title=title, summary=summary, body_md=summary, category=category,
            scope=scope, campus_label=author.campus_label, status=status, vote_count=votes, team_size=team, review_note=note,
            created_at=created, updated_at=created, expires_at=created + timedelta(days=settings.idea_ttl_days),
        )
        idea.author = author
        db.add(idea)
        # votes and team rows have no relationship to the idea, so I flush to write the idea first
        await db.flush()
        idea_rows[key] = idea
        feed(db, "idea_created", created, actor_id=author.id, idea_id=idea.id, campus_label=author.campus_label,
             data={"actor_name": author.display_name, "idea_title": title, "category": category})
        # the people who vote and join are everyone but the author, in a different order for each idea
        others = [user for user in users if user.id != author.id]
        others = others[index * 7 % len(others):] + others[:index * 7 % len(others)]
        reached = votes >= settings.vote_threshold
        vote_window = (created, now) if not reached else (created, created + timedelta(days=days_ago / 3))
        for number, voter in enumerate(others[:votes]):
            share = (number + 1) / (votes + 1)
            voted = vote_window[0] + (vote_window[1] - vote_window[0]) * share
            db.add(IdeaVote(idea_id=idea.id, user_id=voter.id, created_at=voted))
        if not reached:
            continue
        idea.review_started_at = vote_window[1]
        feed(db, "idea_reached_review", idea.review_started_at, idea_id=idea.id, campus_label=idea.campus_label, data={"idea_title": title})
        if status == "in_review":
            continue
        idea.decided_at = idea.review_started_at + timedelta(days=1)
        decision = {"needs_changes": "needs_changes", "rejected": "reject"}.get(status, "approve")
        feed(db, "idea_decided", idea.decided_at, actor_id=gov.id, idea_id=idea.id, campus_label=idea.campus_label,
             data={"idea_title": title, "decision": decision})
        if decision != "approve":
            continue
        team_members = [author] + others[:team - 1]
        for number, member in enumerate(team_members):
            db.add(IdeaTeamMember(idea_id=idea.id, user_id=member.id, joined_at=idea.decided_at + timedelta(hours=number)))
        if team >= settings.team_min:
            idea.team_formed_at = idea.decided_at + timedelta(hours=team)
            feed(db, "team_formed", idea.team_formed_at, idea_id=idea.id, campus_label=idea.campus_label, data={"idea_title": title})

    for index, (key, idea_key, title, days, hour, hours, place, online, network) in enumerate(events):
        idea = idea_rows.get(idea_key)
        creator = idea.author if idea is not None else by_role["curator"]
        starts, ends = event_times(now, days, hour, hours)
        published = min(now - timedelta(hours=2 + index), starts - timedelta(days=4))
        campus_label = None if network else creator.campus_label
        event = Event(
            id=demo_id("event", key), idea_id=idea.id if idea is not None else None, created_by=creator.id, title=title,
            description_md=descriptions[key], starts_at=starts, ends_at=ends, location_text=place, online_url=online,
            campus_label=campus_label, created_at=published,
        )
        db.add(event)
        await db.flush()
        # the student account goes to two events this week, so its personal page has plans
        going = [user for user in members[index * 5:] + members[:index * 5]][:9 + index * 3 % 17]
        if key in ("cooking", "careers"):
            going.append(by_role["student"])
        for user in going:
            db.add(EventRsvp(event_id=event.id, user_id=user.id, created_at=published + timedelta(hours=1)))
        event.going_count = len(going)
        feed(db, "event_published", published, actor_id=creator.id, idea_id=event.idea_id, event_id=event.id, campus_label=campus_label,
             data={"event_title": title, "idea_title": idea.title if idea is not None else None, "starts_at": starts.isoformat()})
    await db.commit()


def feed(db, kind, at, **fields):
    # the same rows emit() writes, with the time of the story instead of now; the worker ships them to ClickHouse
    db.add(Outbox(uid=demo_id("feed", f"{kind}:{fields.get('actor_id')}:{fields.get('idea_id')}:{fields.get('event_id')}"), kind=kind, created_at=at, **fields))


async def refresh(db, settings):
    now = utcnow()
    for key, idea_key, _title, days, hour, hours, *_rest in events:
        event = await db.get(Event, demo_id("event", key))
        if event is None:
            continue
        event.starts_at, event.ends_at = event_times(now, days, hour, hours)
        idea = await db.get(Idea, demo_id("idea", idea_key)) if idea_key else None
        # the worker closes an idea once its event is over; an event moved forward opens it again
        if idea is not None and idea.status in ("live", "done"):
            idea.status = "live" if event.ends_at > now else "done"
    rows = (await db.execute(select(Idea).where(Idea.id.in_([demo_id("idea", spec[0]) for spec in ideas if spec[6] == "open"])))).scalars().all()
    for idea in rows:
        if idea.status in ("open", "expired"):
            idea.status = "open"
            idea.expires_at = max(idea.expires_at, now + timedelta(days=settings.idea_ttl_days // 2))
    await db.commit()


async def reopen_accounts(db, settings):
    # There I follow DEMO_PASSWORD from .env, and unblock the seeded accounts after a disable_demo()
    seeded = [demo_id("user", email) for email, *_rest in accounts + member_specs()]
    admin = await db.get(User, demo_id("user", accounts[-1][0]))
    if not verify_password(admin.password_hash, settings.demo_password):
        await db.execute(update(User).where(User.id.in_(seeded)).values(password_hash=hash_password(settings.demo_password)))
    await db.execute(update(User).where(User.id.in_(seeded), User.status == "blocked").values(status="active"))
    await db.commit()


async def disable_demo(hub):
    """Block every account on a demo domain, end their sessions and stop demo sign-ups. Returns how many accounts."""
    async with hub.sessions() as db:
        rows = (await db.execute(select(User.id).where(User.email.endswith(demo_suffix), User.status != "blocked"))).scalars().all()
        await db.execute(update(User).where(User.id.in_(rows)).values(status="blocked"))
        await db.execute(update(EmailDomain).where(EmailDomain.domain.endswith(demo_suffix)).values(is_active=False))
        await db.commit()
    for user_id in rows:
        await drop_all_sessions(hub.redis, user_id)
    return len(rows)


async def write_profiles(hub):
    for email, _name, _role, bio in accounts:
        fields = {"bio": bio, "languages": ["English", "Russian"], "interests": ["events", "travel"], "updated_at": utcnow()}
        await hub.mongo["profiles"].update_one({"_id": str(demo_id("user", email))}, {"$set": fields}, upsert=True)


def logins():
    return [(role, email) for email, _name, role, _bio in accounts]
