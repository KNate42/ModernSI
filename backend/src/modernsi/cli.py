"""
Command line of the backend: dev server, migrations. More commands come with later modules.
This work made by Anfinogentov Nikita
"""
import asyncio
import subprocess
from pathlib import Path

import typer
import uvicorn

from modernsi.core.config import get_settings
from modernsi.core.stores import stores
from modernsi.feed.schema import ensure_schema

cli = typer.Typer(no_args_is_help=True)
backend_dir = Path(__file__).resolve().parents[2]


def run_with_hub(work):
    # There I open the stores for one CLI command and always close them
    async def runner():
        hub = stores(get_settings())
        try:
            return await work(hub)
        finally:
            await hub.close()

    return asyncio.run(runner())


@cli.command()
def dev(port: int = 8040):
    """Run the API with auto-reload."""
    uvicorn.run("modernsi.app:create_app", factory=True, reload=True, port=port)


@cli.command()
def migrate():
    """Apply Postgres migrations and create ClickHouse tables."""
    subprocess.run(["alembic", "upgrade", "head"], cwd=backend_dir, check=True)

    async def clickhouse(hub):
        client = await hub.get_clickhouse()
        if client is None:
            typer.echo("Ooops.. ClickHouse is not reachable, tables not created")
            raise typer.Exit(1)
        await ensure_schema(client)

    run_with_hub(clickhouse)
    typer.echo("migrations applied")


@cli.command("add-domain")
def add_domain_command(domain: str, label: str = typer.Option(..., help="Campus label shown next to names"), country: str = typer.Option(..., help="ISO country code, e.g. KZ")):
    """Allow sign-ups from DOMAIN (and its subdomains) under a campus label."""
    from modernsi.campuses.service import add_domain

    async def work(hub):
        async with hub.sessions() as db:
            row = await add_domain(db, domain, label, country)
            typer.echo(f"allowed {row.domain} as {row.campus_label} ({row.country_code})")

    run_with_hub(work)
