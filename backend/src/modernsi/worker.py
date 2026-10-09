"""
Background worker: every 2 s ships the outbox and sends queued mail; every 10 min expires stale ideas,
closes ideas whose event is over and purges old rows. With a heartbeat file it touches it after every round,
so the container healthcheck can tell a stuck worker from a working one.
This work made by Anfinogentov Nikita
"""
import asyncio
import logging
import time
from pathlib import Path

from modernsi.events.service import finish_events
from modernsi.feed.shipper import purge_old, ship_outbox
from modernsi.ideas.service import expire_ideas
from modernsi.mail.queue import send_pending

log = logging.getLogger("modernsi.worker")


async def run_once(hub, periodic=False):
    result = {"shipped": await ship_outbox(hub), "sent": await send_pending(hub), "expired": 0, "done": 0}
    if periodic:
        async with hub.sessions() as db:
            result["expired"] = await expire_ideas(db)
            result["done"] = await finish_events(db)
        await purge_old(hub)
    return result


async def run_worker(hub, every=2.0, periodic_every=600, heartbeat=None):
    last_periodic = float("-inf")
    while True:
        periodic = time.monotonic() - last_periodic >= periodic_every
        try:
            result = await run_once(hub, periodic)
            if periodic:
                last_periodic = time.monotonic()
            if any(result.values()):
                log.info("worker round: %s", result)
        except Exception:
            # one bad round must not kill the worker; the next round retries
            log.exception("worker round failed")
        if heartbeat is not None:
            Path(heartbeat).touch()
        await asyncio.sleep(every)
