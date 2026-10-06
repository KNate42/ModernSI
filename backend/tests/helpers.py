"""
Helpers shared by tests: reading mail from Mailpit; later tasks add user helpers here.
This work made by Anfinogentov Nikita
"""
import asyncio

import httpx

MAILPIT = "http://localhost:28025"
ORIGIN = "http://localhost:3000"


async def last_mail(to, subject_contains=""):
    # Mailpit lists newest first; I poll briefly because SMTP delivery is not instant
    async with httpx.AsyncClient(base_url=MAILPIT) as http:
        for _ in range(30):
            data = (await http.get("/api/v1/messages")).json()
            for message in data["messages"]:
                to_match = any(item["Address"] == to for item in message["To"])
                if to_match and subject_contains in message["Subject"]:
                    full = (await http.get(f"/api/v1/message/{message['ID']}")).json()
                    return {"subject": message["Subject"], "text": full["Text"]}
            await asyncio.sleep(0.1)
    raise AssertionError(f"no mail to {to} with subject containing {subject_contains!r}")
