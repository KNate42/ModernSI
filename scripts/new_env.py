"""
Writes the root .env for compose.yml from .env.example, with fresh random secrets, and checks an existing one.
  python3 scripts/new_env.py                                  # demo on http://localhost:8080
  python3 scripts/new_env.py --site http://localhost:9080     # the same on another port
  python3 scripts/new_env.py --site https://modernsi.example.org   # a server with a domain, demo with a random password
  python3 scripts/new_env.py --site https://modernsi.example.org --live   # real mode: no demo data, real SMTP
  python3 scripts/new_env.py --check                          # is .env usable? (scripts/up.sh runs this every time)
It never overwrites an existing .env unless you add --force (the old secrets would no longer open the stores).
Only the standard library, so it runs on any machine with Python 3.
This work made by Anfinogentov Nikita
"""
import argparse
import secrets
import sys
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parent.parent
secret_names = ["POSTGRES_PASSWORD", "REDIS_PASSWORD", "MONGO_PASSWORD", "CLICKHOUSE_PASSWORD", "LOG_SALT"]
local_hosts = ("localhost", "127.0.0.1")
default_ports = {"http": 80, "https": 443}


def fail(message):
    print("Ooops.. " + message)
    sys.exit(1)


def normalise(site):
    # There I write the address the way a browser sends it in Origin: lowercase host, no default port,
    # otherwise the API would refuse every form with "bad origin"
    parts = urlsplit(site.strip().rstrip("/"))
    if parts.scheme not in ("http", "https") or not parts.hostname or parts.path not in ("", "/") or parts.query:
        fail("the site address looks like http://localhost:8080 or https://your.domain, nothing after the host")
    port = parts.port
    host = parts.hostname.lower()
    if port is None or port == default_ports[parts.scheme]:
        return f"{parts.scheme}://{host}"
    return f"{parts.scheme}://{host}:{port}"


def ports_of(site):
    # There I take the ports from the address itself, so the address and the ports can never disagree
    parts = urlsplit(site)
    if parts.scheme == "http":
        http_port = parts.port or 80
        return http_port, 8443 if http_port != 8443 else 9443
    return 80, parts.port or 443


def is_local(site):
    return urlsplit(site).hostname in local_hosts


def read_env(path):
    values = {}
    for line in path.read_text().splitlines():
        if line.strip() and not line.startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip()
    return values


def check(path):
    """The mistakes that give a stack which starts 'healthy' and still does not work, or is open to anyone."""
    if not path.exists():
        fail(".env is missing: run python3 scripts/new_env.py")
    values = read_env(path)
    problems = []
    weak = [name for name in secret_names + ["DEMO_PASSWORD"] if values.get(name) == "change-me"]
    if weak:
        problems.append(", ".join(weak) + " still 'change-me': delete .env and run python3 scripts/new_env.py")
    missing = [name for name in secret_names if not values.get(name)]
    if missing:
        problems.append(", ".join(missing) + " empty: delete .env and run python3 scripts/new_env.py")
    site = values.get("SITE_ADDRESS", "")
    parts = urlsplit(site)
    if parts.scheme not in default_ports or not parts.hostname:
        problems.append(f"SITE_ADDRESS={site!r} is not an address like http://localhost:8080 or https://your.domain")
    else:
        if site != normalise(site):
            problems.append(f"write SITE_ADDRESS as {normalise(site)} (the way browsers send it)")
        port = parts.port or default_ports[parts.scheme]
        name = "HTTP_PORT" if parts.scheme == "http" else "HTTPS_PORT"
        if values.get(name) != str(port):
            problems.append(f"SITE_ADDRESS uses port {port} but {name}={values.get(name)}: set {name}={port}")
        if values.get("DEMO") == "on" and not is_local(site) and values.get("DEMO_PASSWORD", "modernsi-demo") == "modernsi-demo":
            problems.append("a public demo with the published password modernsi-demo: set DEMO_PASSWORD to something only you know")
    if values.get("DEMO") != "on" and values.get("SMTP_HOST", "") in ("", "mailpit"):
        problems.append("DEMO is off but SMTP_HOST is empty or Mailpit: fill in your mail provider's SMTP settings")
    if problems:
        print("Ooops.. .env needs a fix before the site can work:")
        for problem in problems:
            print("  - " + problem)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Write .env for compose.yml with fresh secrets.")
    parser.add_argument("--site", default="http://localhost:8080", help="public address, e.g. https://modernsi.example.org")
    parser.add_argument("--live", action="store_true", help="no demo data and no Mailpit; fill in SMTP_* in .env afterwards")
    parser.add_argument("--force", action="store_true", help="replace an existing .env")
    parser.add_argument("--check", action="store_true", help="only check the existing .env")
    args = parser.parse_args()

    target = root / ".env"
    if args.check:
        check(target)
        return
    if target.exists() and not args.force:
        fail(".env already exists; edit it, or add --force to replace it (only on a stack without data: the stores keep their old passwords!)")
    site = normalise(args.site)
    http_port, https_port = ports_of(site)
    values = {"SITE_ADDRESS": site, "HTTP_PORT": str(http_port), "HTTPS_PORT": str(https_port)}
    values.update({name: secrets.token_hex(24) for name in secret_names})
    # the README publishes modernsi-demo; it is fine on your own computer, never on an address the internet can reach
    values["DEMO_PASSWORD"] = "modernsi-demo" if is_local(site) else secrets.token_urlsafe(9)
    if args.live:
        values.update(DEMO="off", COMPOSE_PROFILES="", SMTP_HOST="", SMTP_PORT="587", SMTP_STARTTLS="true")

    lines = []
    for line in (root / ".env.example").read_text().splitlines():
        name = line.split("=", 1)[0]
        if not line.startswith("#") and "=" in line and name in values:
            line = f"{name}={values[name]}"
        lines.append(line)
    target.write_text("\n".join(lines) + "\n")
    target.chmod(0o600)

    print(f"wrote {target}")
    print(f"  site:  {site}  (Caddy on ports {http_port} and {https_port})")
    if args.live:
        print("  mode:  live, set SMTP_HOST, SMTP_USER, SMTP_PASSWORD and MAIL_FROM in .env now")
    else:
        print(f"  mode:  demo, e-mails go to Mailpit; demo password: {values['DEMO_PASSWORD']}")
        if not is_local(site):
            print("  This demo is reachable from the internet: anyone with the demo password can log in as the demo admin.")
            print("  Keep it to a short look, then go live (see 'Going live' in README.md).")
    print("next:  ./scripts/up.sh")


main()
