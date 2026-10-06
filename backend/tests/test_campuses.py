"""
Allowed domains: exact and subdomain matches, inactive domains, requests for new domains.
This work made by Anfinogentov Nikita
"""
from modernsi.campuses.service import add_domain, domain_of, find_domain


async def test_domain_of_normalises():
    assert domain_of("  Aru@Student.Uni.EDU ") == "student.uni.edu"


async def test_find_domain_exact_and_subdomain(hub):
    async with hub.sessions() as db:
        await add_domain(db, "uni.edu", "Almaty", "KZ")
        assert (await find_domain(db, "aru@uni.edu")).campus_label == "Almaty"
        assert (await find_domain(db, "aru@student.uni.edu")).campus_label == "Almaty"
        assert await find_domain(db, "aru@evil-uni.edu") is None
        assert await find_domain(db, "aru@uni.edu.evil.com") is None


async def test_more_specific_domain_wins(hub):
    async with hub.sessions() as db:
        await add_domain(db, "uni.edu", "Almaty", "KZ")
        await add_domain(db, "tbilisi.uni.edu", "Tbilisi", "GE")
        assert (await find_domain(db, "nino@tbilisi.uni.edu")).campus_label == "Tbilisi"


async def test_inactive_domain_does_not_match(hub):
    async with hub.sessions() as db:
        domain = await add_domain(db, "uni.edu", "Almaty", "KZ")
        domain.is_active = False
        await db.commit()
        assert await find_domain(db, "aru@uni.edu") is None


async def test_request_new_domain(client):
    body = {"domain": "Newcampus.edu", "university_name": "New Campus University", "requester_email": "dana@newcampus.edu"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.status_code == 201
    first = response.json()
    assert first["status"] == "pending"
    again = await client.post("/api/campuses/requests", json=body)
    assert again.json()["id"] == first["id"]


async def test_request_email_must_match_domain(client):
    body = {"domain": "newcampus.edu", "university_name": "New Campus University", "requester_email": "dana@gmail.com"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "email_domain_mismatch"


async def test_request_rejects_garbage_domain(client):
    body = {"domain": "not a domain", "university_name": "X University", "requester_email": "a@b.edu"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.json()["error"]["code"] == "invalid_domain"


async def test_request_for_allowed_domain_is_conflict(client, hub):
    async with hub.sessions() as db:
        await add_domain(db, "uni.edu", "Almaty", "KZ")
    body = {"domain": "uni.edu", "university_name": "Uni", "requester_email": "aru@uni.edu"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "domain_already_allowed"
