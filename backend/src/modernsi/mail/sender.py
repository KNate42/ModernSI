"""
Sends one plain-text e-mail over SMTP. smtplib is blocking, so I run it in a thread.
This work made by Anfinogentov Nikita
"""
import asyncio
import smtplib
from email.message import EmailMessage


def send_blocking(settings, to_email, subject, body):
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_starttls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


async def send_now(settings, to_email, subject, body):
    await asyncio.to_thread(send_blocking, settings, to_email, subject, body)
