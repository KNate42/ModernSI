"""
Tiny dependencies that hand the shared stores and settings to endpoints.
This work made by Anfinogentov Nikita
"""
from fastapi import Request


def get_hub(request: Request):
    return request.app.state.stores


def get_config(request: Request):
    return request.app.state.settings
