"""
Plain-text e-mails. Every function returns (subject, body).
This work made by Anfinogentov Nikita
"""

signature = "\n\n— ModernSI, an independent international student network"


def verify_code(code):
    return (
        f"Your ModernSI code: {code}",
        f"Your confirmation code is {code}.\nIt works for 15 minutes.\n\nIf you did not sign up for ModernSI, ignore this e-mail." + signature,
    )


def reset_code(code):
    return (
        f"Reset your ModernSI password: {code}",
        f"Your password reset code is {code}.\nIt works for 15 minutes.\n\nIf you did not ask to reset your password, ignore this e-mail." + signature,
    )


def domain_approved(domain, site_url):
    return (
        "Your university is now on ModernSI",
        f"Good news: e-mail addresses on {domain} can now join ModernSI.\nSign up here: {site_url}/join" + signature,
    )


def idea_in_review(title, url):
    return (
        f"Your idea is in review: {title}",
        f"“{title}” collected enough support and went to Student Government for review.\nFollow it here: {url}" + signature,
    )


def idea_decided(title, decision, note, url):
    headline = {
        "approve": "was approved — now gather a team",
        "reject": "was not approved",
        "needs_changes": "needs a few changes",
    }[decision]
    note_text = f"\n\nNote from Student Government:\n{note}" if note else ""
    return (f"Your idea {headline}: {title}", f"“{title}” {headline}.{note_text}\n\nOpen it: {url}" + signature)


def team_formed(title, url):
    return (
        f"The team is ready: {title}",
        f"Enough people joined the team for “{title}”. Set a date and place to put it on the Hub: {url}" + signature,
    )


def event_published(title, url):
    return (
        f"It is on the Hub: {title}",
        f"An event for “{title}”, the idea you are part of, is now on the Hub: {url}" + signature,
    )
